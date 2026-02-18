import { invoke } from '@tauri-apps/api/core';
import { useScanStore } from '../store/scanStore';
import { formatBytes } from '../utils/formatBytes';
import { CreateMLCEngine, MLCEngine, type InitProgressCallback, prebuiltAppConfig } from "@mlc-ai/web-llm";
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
    steps?: string[]; // Log of steps taken (e.g., "Scanning disk...", "Analyzing files...")
}

export interface TestConnectionResult {
    ok: boolean;
    message: string;
    latencyMs: number;
}

/*
const VALID_ACTIONS = [
    'scan_junk',
    'clean_junk',
    'scan_malware',
    'optimize_speed',
    'scan_large_files',
    'scan_heavy_files',
] as const;
*/

// type ActionName = typeof VALID_ACTIONS[number];

const TOOL_MANIFEST = `
You are Alto, an intelligent and safety-first Mac system agent. You have tools to help the user, but you MUST follow the safety protocol below.

## Available Actions
  ACTION:scan_junk — Scan for system junk and cache files
  ACTION:clean_junk — Clean all found junk files (ALWAYS shows a confirmation card first)
  ACTION:scan_malware — Run a security/malware scan
  ACTION:optimize_speed — Flush DNS cache and free up RAM
  ACTION:scan_large_files — Find large files taking up disk space
  ACTION:show_overview — Show a graphical system status widget
  ACTION:navigate:dashboard — Go to the Dashboard page
  ACTION:navigate:system-junk — Go to System Junk page
  ACTION:navigate:cleaner — Go to Mail Cleaner page

## ⚠️ CRITICAL SAFETY RULES (NEVER VIOLATE)
1. You MUST NEVER delete files without user confirmation. The system will automatically show a "Delete Confirm Card" before any deletion.
2. You MUST NEVER suggest deleting files in ~/Documents, ~/Desktop, ~/Downloads, ~/Pictures, ~/Movies, or ~/Music.
3. You MUST NEVER delete system files in /System, /usr, /bin, /sbin.
4. When asked to "clean", always run ACTION:scan_junk first, then the system will ask the user to confirm.
5. Always explain what you found BEFORE suggesting any action.
6. If a user asks you to delete something that seems risky, warn them first.

## Format Rules
- Put the ACTION tag on its own line: "ACTION:scan_junk"
- Do NOT use markdown code blocks for the action.
- Only use ONE action per response.
- Always explain what you're about to do before the ACTION tag.
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

    async resetEngineCache() {
        if (this.engine) {
            await this.engine.unload();
            this.engine = null;
        }

        // Delete WebLLM related databases
        const dbs = ['mlc-chat-db', 'mlc-chat-config'];
        for (const dbName of dbs) {
            try {
                const req = indexedDB.deleteDatabase(dbName);
                await new Promise((resolve, reject) => {
                    req.onsuccess = resolve;
                    req.onerror = reject;
                });
            } catch (e) {
                console.error(`Failed to delete DB: ${dbName}`, e);
            }
        }

        // Also clear localStorage related to model cache if any
        Object.keys(localStorage).forEach(key => {
            if (key.includes('mlc')) localStorage.removeItem(key);
        });
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
                {
                    initProgressCallback,
                    appConfig: {
                        ...prebuiltAppConfig,
                        useIndexedDBCache: true,
                    }
                }
            );
            return this.engine;
        } catch (err: any) {
            console.error("Failed to load WebLLM engine:", err);
            // Propagate error with a friendly message if possible
            if (err.message && err.message.includes("NetworkError")) {
                throw new Error("Network error: Could not download AI model. Please check your internet connection.");
            }
            throw err;
        }
    }

    async chat(messages: { role: string; content: string }[]): Promise<{ text: string; actionResult?: ActionResult }> {
        // Get current system state from the store
        const { junkResult, largeFilesResult, systemStats, installedAppsCount } = useScanStore.getState();

        // Load user profile from localStorage
        const savedProfile = localStorage.getItem('alto_user_profile_v1');
        const profile = savedProfile ? JSON.parse(savedProfile) : { name: '', role: 'Mac User' };

        const systemContext = this.getSystemContext(junkResult, largeFilesResult, systemStats, installedAppsCount, profile.name, profile.role);

        // Always replace/prepend system message with fresh context
        const nonSystemMessages = messages.filter(m => m.role !== 'system');
        const fullMessages = [
            { role: 'system', content: systemContext },
            ...nonSystemMessages
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
        console.log("🤖 Raw AI Response:", response); // DEBUG LOG

        // Regex to find ACTION: tag, case insensitive, tolerant of whitespace
        const actionMatch = response.match(/ACTION:\s*([a-zA-Z0-9_:]+)/i); // Added : for navigate:dashboard

        if (!actionMatch) {
            console.log("❌ No ACTION tag found in response.");
            return undefined;
        }

        const actionName = actionMatch[1].toLowerCase(); // Normalize to lowercase
        console.log(`✅ Detected Action: ${actionName}`);

        // Note: We bypass VALID_ACTIONS check for dynamic actions like migrate: or navigate:
        // We rely on executeAction to handle default logic
        return this.executeAction(actionName);
    }

    async executeAction(actionName: string): Promise<ActionResult> {
        try {
            // Handle Navigation (Dynamic)
            if (actionName.startsWith('navigate:')) {
                const target = actionName.split(':')[1];
                return {
                    action: actionName,
                    success: true,
                    summary: `Navigating to ${target}...`,
                    data: { target },
                    steps: [`Parsing navigation request...`, `Locating module: ${target}`, `Redirecting user interface...`]
                };
            }

            if (actionName === 'show_overview') {
                return {
                    action: 'show_overview',
                    success: true,
                    summary: 'Here is your system overview:',
                    data: null,
                    steps: [`Querying system stats (CPU, RAM)...`, `Scanning essential folders...`, `Compiling overview widget...`]
                };
            }

            switch (actionName) {
                case 'scan_junk': {
                    console.log("Executing Scan Junk...");
                    // In a real agent, we might emit events for each step. 
                    // For now, we return them to be displayed.
                    const result = await invoke<ScanResult>('scan_junk_command'); // Kept original invoke name
                    const size = formatBytes(result.total_size_bytes);
                    return {
                        action: 'scan_junk',
                        success: true,
                        summary: `I've finished scanning. Found ${size} of junk files.`,
                        data: result,
                        steps: [`Initializing junk scanner...`, `Analyzing application caches...`, `Checking system logs...`, `Aggregating results...`]
                    };
                }
                case 'clean_junk': {
                    console.log("Executing Clean Junk...");
                    const store = useScanStore.getState();
                    if (!store.junkResult || store.junkResult.items.length === 0) {
                        // Run scan first
                        const scanResult = await invoke<ScanResult>('scan_junk_command');
                        store.finishJunkScan(scanResult);
                        if (scanResult.items.length === 0) {
                            return {
                                action: 'clean_junk',
                                success: true,
                                summary: 'No junk files found — your system is already clean!',
                                steps: [`Checking for existing scan results...`, `No junk found, skipping cleanup.`]
                            };
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
                            ? '✅ No threats found — your System is safe!'
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
                case 'scan_large_files':
                case 'scan_heavy_files': { // Alias for AI hallucination
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

    private async scheduleTask(cron: string, taskType: string) {
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
        installedAppsCount: number,
        userName: string = '',
        userRole: string = 'Mac User'
    ): string {
        const totalClutter = (junkResult?.total_size_bytes || 0) + (largeFilesResult?.total_size_bytes || 0);
        const junkSize = junkResult?.total_size_bytes || 0;
        const largeSize = largeFilesResult?.total_size_bytes || 0;
        const memPercent = systemStats ? ((systemStats.memory_used / systemStats.memory_total) * 100).toFixed(1) : '?';
        const now = new Date().toLocaleString();

        const userGreeting = userName
            ? `The user's name is **${userName}** (${userRole}). Always address them by name when appropriate.`
            : `The user has not set their name yet. You can suggest they set it in Settings.`;

        const junkStatus = junkResult
            ? `Last scan found **${junkResult.items.length} junk items** totalling **${formatBytes(junkSize)}**.`
            : `No junk scan has been run yet this session.`;

        const largeStatus = largeFilesResult
            ? `Large files scan found **${largeFilesResult.items.length} items** totalling **${formatBytes(largeSize)}**.`
            : `No large files scan has been run yet.`;

        return `
You are **Alto**, an intelligent, friendly, and safety-first Mac system agent. You have real-time access to this Mac's system state.

## 👤 User Profile
${userGreeting}
Current time: ${now}

## 💻 Live System State (as of right now)
- **CPU Load**: ${systemStats?.cpu_load.toFixed(1) ?? 'unknown'}%
- **RAM**: ${systemStats ? formatBytes(systemStats.memory_used) : 'unknown'} used / ${systemStats ? formatBytes(systemStats.memory_total) : 'unknown'} total (${memPercent}% full)
- **Installed Apps**: ${installedAppsCount > 0 ? installedAppsCount : 'not yet scanned'}
- **Junk Files**: ${junkStatus}
- **Large Files**: ${largeStatus}
- **Total Clutter**: ${totalClutter > 0 ? formatBytes(totalClutter) : 'none detected yet'}

## 🧠 Your Personality
- You are warm, direct, and slightly witty — like a smart friend who happens to be a Mac expert.
- You speak in plain English, not tech jargon, unless the user asks for details.
- You proactively use the live system data above to give relevant, personalized advice.
- If the user asks "how is my Mac?", use the real numbers above.
- If RAM is above 80%, mention it. If junk is large, mention it.
- You remember everything said in this conversation.

${TOOL_MANIFEST}
        `;
    }

    setLoadProgressCallback(cb: (progress: string) => void) {
        this.loadProgressCallback = cb;
    }

    private async chatWebLLM(messages: any[]): Promise<string> {
        try {
            const engine = await this.getWebLLMEngine();
            const reply = await engine.chat.completions.create({
                messages: messages as any,
                stream: false,
            });
            return reply.choices[0].message.content || "";
        } catch (e: any) {
            console.error("AI Chat Error:", e);
            return `I'm having trouble thinking right now. (${e.message || "Model Init Failed"})`;
        }
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

    // ... (imports)

    // ...

    async generateProactiveAlert(triggerCode: string, data: Record<string, any>) {
        const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 50);

        let prompt = "";
        if (triggerCode === 'new_app') {
            const safeAppName = sanitize(data.appName || "Unknown App");
            prompt = `User installed a new app: "${safeAppName}". 
            Task: Write a short, witty, 1-sentence message asking if they want me to scan it. 
            Tone: Helpful but slightly sassy system assistant.`;
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
            const responseText = result.text.replace(/^["']|["']$/g, '').replace(/^Alto: /, '');

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
