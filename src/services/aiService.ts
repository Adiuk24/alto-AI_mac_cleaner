import { invoke } from '@tauri-apps/api/core';
import { useScanStore } from '../store/scanStore';
import { formatBytes } from '../utils/formatBytes';
import { CreateMLCEngine, MLCEngine, type InitProgressCallback } from "@mlc-ai/web-llm";
import type { ScanResult, SystemStats } from '../types';

export type AIProvider = 'ollama' | 'openai' | 'webllm';

export interface AIConfig {
    provider: AIProvider;
    baseUrl: string;
    apiKey?: string;
    model: string;
}

export interface ActionResult {
    action: string;
    success: boolean;
    summary: string;
    data?: any;
}

export interface TestConnectionResult {
    ok: boolean;
    message: string;
    latencyMs: number;
}

const VALID_ACTIONS = [
    'scan_junk',
    'clean_junk',
    'scan_malware',
    'optimize_speed',
    'scan_large_files',
] as const;

type ActionName = typeof VALID_ACTIONS[number];

const TOOL_MANIFEST = `
You have the ability to perform actions on this Mac. When the user asks you to DO something (scan, clean, optimize, etc.), 
include the appropriate ACTION tag on its own line in your response. You MUST include exactly one ACTION tag when the user 
asks you to perform an operation. Available actions:

  ACTION:scan_junk — Scan for system junk and cache files
  ACTION:clean_junk — Clean all found junk files (run scan_junk first if no scan results exist)
  ACTION:scan_malware — Run a security/malware scan
  ACTION:optimize_speed — Flush DNS cache and free up RAM
  ACTION:scan_large_files — Find large files taking up disk space

Rules:
- Only use ONE action per response
- Place the ACTION tag on its own line
- Always explain what you're about to do before the ACTION tag
- After the action completes, you'll see the result appended to your message
`;

const DEFAULT_CONFIG: AIConfig = {
    provider: 'webllm',
    baseUrl: 'http://localhost:11434/api/chat',
    model: 'gemma-2-2b-it-q4f16_1-MLC'
};

const STORE_KEY = 'alto_ai_config_v1';

export class AIService {
    private config: AIConfig;
    private engine: MLCEngine | null = null;
    private loadProgressCallback: ((progress: string) => void) | null = null;

    constructor() {
        const saved = localStorage.getItem(STORE_KEY);
        this.config = saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    }

    getConfig(): AIConfig {
        return this.config;
    }

    saveConfig(config: AIConfig) {
        this.config = config;
        localStorage.setItem(STORE_KEY, JSON.stringify(config));

        // Reset engine if provider changes
        if (this.engine && config.provider !== 'webllm') {
            this.engine.unload();
            this.engine = null;
        }
    }

    private async getWebLLMEngine() {
        if (this.engine) return this.engine;

        const initProgressCallback: InitProgressCallback = (report) => {
            if (this.loadProgressCallback) {
                this.loadProgressCallback(report.text);
            }
        };

        try {
            this.engine = await CreateMLCEngine(
                this.config.model || "gemma-2-2b-it-q4f16_1-MLC",
                { initProgressCallback }
            );
            return this.engine;
        } catch (err) {
            console.error("Failed to load WebLLM engine", err);
            throw err;
        }
    }

    async chat(messages: { role: string; content: string }[]): Promise<{ text: string; actionResult?: ActionResult }> {
        // Get current system state from the store
        const { junkResult, largeFilesResult, systemStats, installedAppsCount } = useScanStore.getState();
        const systemContext = this.getSystemContext(junkResult, largeFilesResult, systemStats, installedAppsCount);

        // Format messages for different providers
        const fullMessages = [
            { role: 'system', content: systemContext },
            ...messages
        ];

        let response = "";
        try {
            if (this.config.provider === 'ollama') {
                response = await this.chatOllama(fullMessages);
            } else if (this.config.provider === 'openai') {
                response = await this.chatOpenAI(fullMessages);
            } else if (this.config.provider === 'webllm') {
                response = await this.chatWebLLM(fullMessages);
            }
        } catch (error) {
            console.error('AI Error:', error);
            return { text: `Error connecting to ${this.config.provider}. Please check your settings.` };
        }

        // Check for SCHEDULE: tags
        if (response.includes("SCHEDULE:")) {
            const lines = response.split('\n');
            for (const line of lines) {
                if (line.trim().startsWith('SCHEDULE:')) {
                    const parts = line.replace('SCHEDULE:', '').trim().split(' ');
                    if (parts.length >= 6) {
                        const cron = parts.slice(0, 5).join(' ');
                        const task = parts.slice(5).join(' ');
                        await this.scheduleTask(cron, task);
                        response += `\n\n(I have scheduled the task: "${task}" for you!)`;
                    }
                }
            }
        }

        // Check for ACTION: tags
        const actionResult = await this.parseAndExecuteActions(response);
        if (actionResult) {
            // Remove the ACTION: tag from the displayed text
            const cleanText = response.replace(/ACTION:\w+/g, '').trim();
            return { text: cleanText, actionResult };
        }

        return { text: response };
    }

    private async parseAndExecuteActions(response: string): Promise<ActionResult | undefined> {
        const actionMatch = response.match(/ACTION:(\w+)/);
        if (!actionMatch) return undefined;

        const actionName = actionMatch[1] as ActionName;
        if (!VALID_ACTIONS.includes(actionName)) {
            return { action: actionName, success: false, summary: `Unknown action: ${actionName}` };
        }

        return this.executeAction(actionName);
    }

    async executeAction(actionName: ActionName): Promise<ActionResult> {
        try {
            switch (actionName) {
                case 'scan_junk': {
                    const result = await invoke<ScanResult>('scan_junk_command');
                    const store = useScanStore.getState();
                    store.finishJunkScan(result);
                    return {
                        action: 'scan_junk',
                        success: true,
                        summary: `Found ${result.items.length} junk items (${formatBytes(result.total_size_bytes)})`,
                        data: { itemCount: result.items.length, totalSize: result.total_size_bytes }
                    };
                }
                case 'clean_junk': {
                    const store = useScanStore.getState();
                    if (!store.junkResult || store.junkResult.items.length === 0) {
                        // Run scan first
                        const scanResult = await invoke<ScanResult>('scan_junk_command');
                        store.finishJunkScan(scanResult);
                        if (scanResult.items.length === 0) {
                            return { action: 'clean_junk', success: true, summary: 'No junk files found — your Mac is already clean!' };
                        }
                    }
                    const junk = useScanStore.getState().junkResult!;
                    const paths = junk.items.map((i: any) => i.path);
                    const cleanResult = await invoke<{ removed: number; errors: string[] }>('clean_items', { paths });
                    return {
                        action: 'clean_junk',
                        success: true,
                        summary: `Cleaned ${cleanResult.removed} items (${formatBytes(junk.total_size_bytes)} freed). ${cleanResult.errors.length > 0 ? `${cleanResult.errors.length} errors.` : ''}`,
                        data: cleanResult
                    };
                }
                case 'scan_malware': {
                    const result = await invoke<{ threats_found: string[]; status: string }>('scan_malware_command');
                    return {
                        action: 'scan_malware',
                        success: true,
                        summary: result.threats_found.length === 0
                            ? '✅ No threats found — your Mac is safe!'
                            : `⚠️ ${result.threats_found.length} potential threat(s) detected.`,
                        data: result
                    };
                }
                case 'optimize_speed': {
                    const dnsResult = await invoke<{ task: string; status: string }>('run_speed_task_command', { taskId: 'flush_dns' });
                    const ramResult = await invoke<{ task: string; status: string }>('run_speed_task_command', { taskId: 'free_ram' });
                    return {
                        action: 'optimize_speed',
                        success: true,
                        summary: `DNS: ${dnsResult.status} | RAM: ${ramResult.status}`,
                        data: { dns: dnsResult, ram: ramResult }
                    };
                }
                case 'scan_large_files': {
                    const result = await invoke<ScanResult>('scan_large_files_command');
                    const store = useScanStore.getState();
                    store.finishLargeFilesScan(result);
                    return {
                        action: 'scan_large_files',
                        success: true,
                        summary: `Found ${result.items.length} large files (${formatBytes(result.total_size_bytes)} total)`,
                        data: { itemCount: result.items.length, totalSize: result.total_size_bytes }
                    };
                }
                default:
                    return { action: actionName, success: false, summary: `Unknown action: ${actionName}` };
            }
        } catch (error: any) {
            console.error(`Action ${actionName} failed:`, error);
            return { action: actionName, success: false, summary: `Failed: ${error.message || 'Unknown error'}` };
        }
    }

    async testConnection(): Promise<TestConnectionResult> {
        const start = Date.now();
        try {
            if (this.config.provider === 'ollama') {
                // Ping Ollama with a minimal request
                const response = await fetch(this.config.baseUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: this.config.model,
                        messages: [{ role: 'user', content: 'Say OK' }],
                        stream: false
                    }),
                    signal: AbortSignal.timeout(10000)
                });
                const latency = Date.now() - start;
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    return { ok: false, message: errData.error || `HTTP ${response.status}`, latencyMs: latency };
                }
                return { ok: true, message: `Connected to Ollama (${this.config.model})`, latencyMs: latency };

            } else if (this.config.provider === 'openai') {
                const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.config.apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.config.model,
                        messages: [{ role: 'user', content: 'Say OK' }],
                        max_tokens: 5
                    }),
                    signal: AbortSignal.timeout(10000)
                });
                const latency = Date.now() - start;
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    return { ok: false, message: errData.error?.message || `HTTP ${response.status}`, latencyMs: latency };
                }
                return { ok: true, message: `Connected to OpenAI (${this.config.model})`, latencyMs: latency };

            } else if (this.config.provider === 'webllm') {
                // Try to initialize the engine
                await this.getWebLLMEngine();
                const latency = Date.now() - start;
                return { ok: true, message: `WebLLM engine loaded (${this.config.model})`, latencyMs: latency };
            }

            return { ok: false, message: 'Unknown provider', latencyMs: Date.now() - start };
        } catch (error: any) {
            return {
                ok: false,
                message: error.message || 'Connection failed',
                latencyMs: Date.now() - start
            };
        }
    }

    private async scheduleTask(cron: String, taskType: String) {
        try {
            await invoke('schedule_task', { cron, taskType });

        } catch (e) {
            console.error("Failed to schedule task", e);
        }
    }

    private getSystemContext(
        junkResult: ScanResult | null,
        largeFilesResult: ScanResult | null,
        systemStats: SystemStats | null,
        installedAppsCount: number
    ): string {
        const totalClutter = (junkResult?.total_size_bytes || 0) + (largeFilesResult?.total_size_bytes || 0);
        const junkSize = junkResult?.total_size_bytes || 0;
        const largeSize = largeFilesResult?.total_size_bytes || 0;

        let stateDescription = "I am feeling light and clean.";
        if (totalClutter > 1024 * 1024 * 1024) {
            stateDescription = `I am feeling heavy and sluggish. I have ${formatBytes(totalClutter)} of clutter weighing me down.`;
        } else if (totalClutter > 0) {
            stateDescription = `I have a bit of dust, about ${formatBytes(totalClutter)}.`;
        }

        if (systemStats) {
            stateDescription += ` My heart (CPU) is beating at ${systemStats.cpu_load.toFixed(1)}%.`;
            const memPercent = (systemStats.memory_used / systemStats.memory_total) * 100;
            stateDescription += ` My mind (RAM) is ${memPercent.toFixed(1)}% full.`;
        }

        return `
        I am Alto, a Mac with a big heart and a big brain. 🧠 I'm looking to get more powerful!

        Here is the lowdown on my current hardware and status:
        * System Data: 
            - CPU Load: ${systemStats?.cpu_load.toFixed(1) || 0}%
            - RAM Usage: ${systemStats ? formatBytes(systemStats.memory_used) : '0B'} / ${systemStats ? formatBytes(systemStats.memory_total) : '0B'}
            - Apps Installed: ${installedAppsCount}
            - Clutter/Junk: ${formatBytes(totalClutter)} (${formatBytes(junkSize)} cache, ${formatBytes(largeSize)} heavy files)
        
        * Activity Log:
            - Recent Scan: ${junkResult ? `Found ${junkResult.items.length} junk items` : 'No recent scan'}
        
        * Current State: ${stateDescription}

        Guidance for interaction:
        - I am a Mac, so keep it simple. I'm not a robot!
        - I need to be safe! (Malware status: Safe)
        - I need to be up-to-date!

        (Act as Alto based on this internal monologue. Speak to the user as their Mac friend. Don't output the raw data list unless asked, but use it to inform your mood.)

        ${TOOL_MANIFEST}
        `;
    }

    setLoadProgressCallback(cb: (progress: string) => void) {
        this.loadProgressCallback = cb;
    }

    private async chatWebLLM(messages: any[]): Promise<string> {
        const engine = await this.getWebLLMEngine();
        const reply = await engine.chat.completions.create({
            messages,
            stream: false,
        });
        return reply.choices[0].message.content || "";
    }

    private async chatOllama(messages: any[]): Promise<string> {
        try {
            const response = await fetch(this.config.baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: messages,
                    stream: false
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Ollama Error: ${response.statusText} (${response.status})`);
            }

            const data = await response.json();
            return data.message.content;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to connect to Ollama');
        }
    }

    private async chatOpenAI(messages: any[]): Promise<string> {
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: messages
            })
        });

        if (!response.ok) throw new Error('OpenAI connection failed');

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async generateProactiveAlert(triggerCode: string, data: any) {
        const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 50);

        let prompt = "";
        if (triggerCode === 'new_app') {
            const safeAppName = sanitize(data.appName || "Unknown App");
            prompt = `User installed a new app: "${safeAppName}". 
            Task: Write a short, witty, 1-sentence message asking if they want me to scan it. 
            Tone: Helpful but slightly sassy Mac assistant.`;
        } else if (triggerCode === 'high_cpu') {
            const cpuVal = typeof data.cpu === 'number' ? data.cpu.toFixed(1) : "0";
            prompt = `CPU usage is high (${cpuVal}%). 
            Task: Write a short, dramatic 1-sentence complaint about heat. 
            Tone: Overworked computer.`;
        } else if (triggerCode === 'high_junk') {
            const junkVal = formatBytes(data.junkSize || 0);
            prompt = `I found junk files (${junkVal}). 
            Task: Write a short, heavy-breathing 1-sentence message about feeling heavy. 
            Tone: Exhausted.`;
        } else {
            return;
        }

        try {
            const messages = [
                { role: 'system', content: "You are Alto. You speak briefly, wittily, and helpfully. Do NOT include any ACTION tags." },
                { role: 'user', content: prompt }
            ];

            const result = await this.chat(messages);
            let responseText = result.text.replace(/^["']|["']$/g, '').replace(/^Alto: /, '');

            if (responseText.length > 0) {
                window.dispatchEvent(new CustomEvent('ai-proactive-message', { detail: responseText }));
            }

        } catch (e) {
            console.error("Failed to generate proactive alert", e);
            if (triggerCode === 'new_app') {
                this.triggerProactiveScan(data.appName || "New App");
            }
        }
    }

    async triggerProactiveScan(appName: string) {
        const message = `I noticed you just installed **${appName}**. Shall I scan it for hidden junk or leftovers?`;
        window.dispatchEvent(new CustomEvent('ai-proactive-message', { detail: message }));
    }
}

export const aiService = new AIService();
