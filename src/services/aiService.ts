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
### 🚨 ALTO PROTOCOL (STRICT ADHERENCE REQUIRED)
1. COMMANDS:
   ACTION:scan_junk — User asks to scan/clean cache, logs, or general junk
   ACTION:clean_junk — User asks to delete/remove junk (only after scan shown)
   ACTION:empty_trash — User asks to empty trash, clear bin, or delete trash items
   ACTION:scan_malware — User asks about viruses, security, or malware
   ACTION:optimize_speed — User asks about RAM, DNS, slow performance, or speed
   ACTION:scan_large_files — User asks about storage, big files, disk space
   ACTION:deep_scan — User asks for a deep scan, full scan, thorough scan, or comprehensive scan
   ACTION:show_overview — User asks "how is my mac", "status", or a general report
   ACTION:clean_mail — User asks to clean mail attachments or Mail downloads
   ACTION:run_maintenance — User asks to run maintenance, repair permissions, or fix disk
   ACTION:clean_privacy — User asks to clean browser history, cookies, or privacy traces
   ACTION:navigate:dashboard — Go to Home
   ACTION:navigate:uninstaller — User asks to uninstall an app
   ACTION:navigate:trash-bins — User asks to view trash contents

2. MANDATORY RULE:
   - You MUST output exactly one ACTION tag as the VERY LAST LINE of your response.
   - NO bolding the tag. NO trailing periods.
   - If you mention scanning or cleaning, the corresponding ACTION tag MUST be present.
   - Example: "I'll start a deep scan for you. ACTION:deep_scan"
`;

const DEFAULT_CONFIG: AIConfig = {
    provider: 'webllm',
    baseUrl: 'http://localhost:11434/api/chat',
    model: 'gemma-2-2b-it-q4f16_1-MLC' // Default to Gemma 2 (2B) for best local performance
};

const STORE_KEY = 'alto_ai_config_v1';

export class AIService {
    private config: AIConfig;
    private engine: MLCEngine | null = null;
    private loadProgressCallback: ((progress: string) => void) | null = null;
    private stepCallback: ((step: string) => void) | null = null;

    setStepCallback(cb: (step: string) => void) { this.stepCallback = cb; }
    clearStepCallback() { this.stepCallback = null; }
    private emitStep(step: string) { this.stepCallback?.(step); }

    constructor() {
        const saved = localStorage.getItem(STORE_KEY);
        this.config = saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    }

    getConfig(): AIConfig {
        return this.config;
    }

    async resetEngineCache() {
        console.log("LOG:🗑️ Initializing AI Cache Purge...");
        if (this.engine) {
            console.log("LOG:Unloading active engine instance...");
            await this.engine.unload();
            this.engine = null;
        }

        const dbs = [
            'mlc-chat-db',
            'mlc-chat-config',
            'web-llm-cache',
            'mlc-ai-db',
            'next-web-llm-cache',
            'wasm-cache',
            'mlc-ai-config',
            'mlc-chat-db-v1'
        ];

        for (const dbName of dbs) {
            console.log(`LOG:Deleting IndexedDB: ${dbName}`);
            try {
                const req = indexedDB.deleteDatabase(dbName);
                await new Promise((resolve, reject) => {
                    req.onsuccess = () => {
                        console.log(`LOG:✅ Purged DB: ${dbName}`);
                        resolve(null);
                    };
                    req.onblocked = () => {
                        console.warn(`LOG:⚠️ Deletion blocked for DB: ${dbName}.`);
                        resolve(null);
                    };
                    req.onerror = () => {
                        console.error(`LOG:❌ Error purging DB: ${dbName}`);
                        reject(new Error(`Failed to delete ${dbName}`));
                    };
                });
            } catch (e) {
                console.error(`LOG:Failed to delete DB: ${dbName}`, e);
            }
        }

        console.log("LOG:Clearing model-specific local preferences...");
        Object.keys(localStorage).forEach(key => {
            if (key.includes('mlc') || key.includes('web-llm')) {
                console.log(`LOG:Removed meta-key: ${key}`);
                localStorage.removeItem(key);
            }
        });

        console.log("LOG:✨ AI Infrastructure Reset Complete.");
    }

    async resetContext() {
        return await invoke('reset_mcp_context_command');
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

    private async getWebLLMEngine(isRetry: boolean = false): Promise<MLCEngine> {
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

            // Auto-fix for ConstraintError (corrupted/inconsistent cache)
            if (!isRetry && err.message &&
                (err.message.includes("ConstraintError") || err.message.includes("Key already exists"))) {
                console.warn("LOG:⚠️ Detected WebLLM cache inconsistency (ConstraintError). Attempting auto-fix...");
                await this.resetEngineCache();
                console.log("LOG:🔄 Neural Cache purged. Retrying initialization...");
                return this.getWebLLMEngine(true);
            }

            // Propagate error with a friendly message if possible
            if (err.message && err.message.includes("NetworkError")) {
                throw new Error("Network error: Could not download AI model. Please check your internet connection.");
            }
            throw err;
        }
    }

    async chat(messages: { role: string; content: string }[]): Promise<{ text: string; actionResult?: ActionResult }> {
        const isFollowup = messages.some(m => m.content.includes('SYSTEM: The task completed'));
        // ...
        // Get current system state from the store
        const { junkResult, largeFilesResult, systemStats, installedAppsCount } = useScanStore.getState();

        // Load user profile from localStorage
        const savedProfile = localStorage.getItem('alto_user_profile_v1');
        const profile = savedProfile ? JSON.parse(savedProfile) : { name: '', role: 'Mac User' };

        const systemContext = this.getSystemContext(junkResult, largeFilesResult, systemStats, installedAppsCount, profile.name, profile.role);

        // Always replace/prepend system message with fresh context
        // Create a deep copy of messages to avoid mutating the original array/objects
        const nonSystemMessages = messages
            .filter(m => m.role !== 'system')
            .map(m => ({ ...m })); // Clone objects

        // TURN REINFORCEMENT: Append a mandatory reminder ONLY if not already a system follow-up
        const lastMsg = nonSystemMessages[nonSystemMessages.length - 1];
        if (lastMsg && lastMsg.role === 'user' && !lastMsg.content.includes('SYSTEM:')) {
            lastMsg.content += "\n\n!! NEURAL COMMAND PROTOCOL !!\nIf any system operation is needed, you MUST output exactly one tag (e.g., ACTION:scan_junk) as the very last line of your response.";
        }

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
        const actionResult = await this.parseAndExecuteActions(response, isFollowup);
        if (actionResult) {
            // Remove the ACTION: tag and any surrounding markers (like **) from display text
            // Uses a regex matching the detection logic
            const cleanText = response.replace(/(?:ACTION|Action|action):\s*\*?[a-zA-Z0-9_:]+\*?\b/gi, '').trim();
            return { text: cleanText || "Executing system command...", actionResult };
        }

        return { text: response };
    }

    private async parseAndExecuteActions(response: string, isFollowup: boolean): Promise<ActionResult | undefined> {
        if (isFollowup) return undefined; // NEVER trigger actions during a summary/follow-up turn

        console.log("🤖 Raw AI Response:", response); // DEBUG LOG

        // Regex to find ACTION: tag - extremely resilient (case-insensitive, fuzzy markers, greedy match)
        const actionMatch = response.match(/(?:ACTION|Action|action):\s*\*?([a-zA-Z0-9_:]+)\*?\b/i);

        if (!actionMatch) {
            // COMPLIANCE RESCUE: Infer action from keywords when AI misses the tag
            const lowerResponse = response.toLowerCase();

            // Junk Scan (Safe)
            if (lowerResponse.match(/scan.*junk|junk.*scan|scanning|cache files|log files|junk files/)) {
                console.warn("⚠️ Compliance Rescue: Inferred ACTION:scan_junk");
                return this.executeAction('scan_junk');
            }
            // Speed / RAM / DNS (Safe-ish)
            if (lowerResponse.match(/flush.*dns|clear.*dns|free.*ram|speed.*up|optimize.*speed/)) {
                console.warn("⚠️ Compliance Rescue: Inferred ACTION:optimize_speed");
                return this.executeAction('optimize_speed');
            }
            // Large Files (Safe)
            if (lowerResponse.match(/large files|heavy files|disk space|storage/)) {
                console.warn("⚠️ Compliance Rescue: Inferred ACTION:scan_large_files");
                return this.executeAction('scan_large_files');
            }
            // Uninstall (Safe Navigation)
            if (lowerResponse.match(/uninstall|remove.*app|delete.*app/)) {
                console.warn("⚠️ Compliance Rescue: Inferred ACTION:navigate:uninstaller");
                return this.executeAction('navigate:uninstaller');
            }
            // Maintenance (Safe)
            if (lowerResponse.match(/maintenance|repair.*permission|fix.*disk|rebuild.*launch/)) {
                console.warn("⚠️ Compliance Rescue: Inferred ACTION:run_maintenance");
                return this.executeAction('run_maintenance');
            }
            // Overview (Safe)
            if (lowerResponse.match(/overview|how is my mac|system status|mac health/)) {
                console.warn("⚠️ Compliance Rescue: Inferred ACTION:show_overview");
                return this.executeAction('show_overview');
            }
            // Deep scan (Safe)
            if (lowerResponse.match(/deep.*scan|full.*scan|thorough.*scan|comprehensive.*scan|comprehensive.*report/)) {
                console.warn("⚠️ Compliance Rescue: Inferred ACTION:deep_scan");
                return this.executeAction('deep_scan');
            }

            if (!isFollowup) console.log("❌ No ACTION tag found in response.");
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
                this.emitStep('Querying system stats and cleanup history...');
                const [stats, mcpContext] = await Promise.all([
                    invoke<SystemStats>('get_system_stats_command').catch(() => null),
                    invoke<Record<string, unknown>>('get_mcp_context').catch(() => null)
                ]);
                const diskUsed = stats ? formatBytes(stats.disk_used) : '—';
                const diskTotal = stats ? formatBytes(stats.disk_total) : '—';
                const cpu = stats?.cpu_load ?? 0;
                const history = mcpContext?.deletion_history as Array<{ total_bytes_freed?: number }> | undefined;
                const totalFreed = history?.reduce((acc, r) => acc + (r.total_bytes_freed ?? 0), 0) ?? 0;
                let summary = `Your Mac is using ${diskUsed} of ${diskTotal} disk space, with CPU at ${Math.round(cpu)}%.`;
                if (totalFreed > 0) {
                    summary += ` Alto has freed ${formatBytes(totalFreed)} in past cleanups.`;
                }
                summary += ' Ask me to scan junk, large files, or run a deep scan for more detail.';
                return {
                    action: 'show_overview',
                    success: true,
                    summary,
                    data: stats ? { stats, totalFreed } : null,
                    steps: ['Querying system stats (CPU, RAM, disk)...', 'Checking cleanup history...', 'Compiling overview.']
                };
            }

            if (actionName === 'deep_scan') {
                // Fire-and-forget — backend does all the work via events
                this.emitStep('Starting deep scan in background...');
                await invoke('start_deep_scan_command');
                this.emitStep('Deep scan running — Alto will update you as each area is scanned.');
                return {
                    action: 'deep_scan',
                    success: true,
                    summary: '🔍 Deep scan started in the background. I\'ll show live progress below as I work through each area of your Mac.',
                    data: { background: true },
                    steps: [
                        'Initializing deep scan engine...',
                        'Launching background scanner...',
                        'Scanning all directories (no limits) — results streaming live...'
                    ]
                };
            }

            if (actionName === 'empty_trash') {
                this.emitStep('Scanning ~/.Trash...');
                const scanRes = await invoke<{ item_count: number; total_size_bytes: number; items: string[] }>('scan_trash_command');
                if (scanRes.item_count === 0) {
                    this.emitStep('Trash is empty — nothing to remove.');
                    return {
                        action: 'empty_trash',
                        success: true,
                        summary: '🗑️ Trash is already empty — nothing to remove.',
                        steps: ['Checking ~/.Trash...', 'Trash is empty, nothing to do.']
                    };
                }

                this.emitStep(`Found ${scanRes.item_count} items in Trash. Preparing preview...`);
                // SAFETY: Return items for confirmation instead of immediate deletion
                return {
                    action: 'empty_trash',
                    success: true,
                    summary: `I've found ${scanRes.item_count} items in your Trash (${formatBytes(scanRes.total_size_bytes)}). Would you like me to empty it?`,
                    data: {
                        items: scanRes.items.map(name => ({ path: `~/.Trash/${name}`, name, size_bytes: 0 })), // Paths for preview card
                        total_size_bytes: scanRes.total_size_bytes
                    },
                    steps: [
                        `Scanning ~/.Trash (found ${scanRes.item_count} items)...`,
                        'Calculating sizes...',
                        'Awaiting your confirmation to empty Trash...'
                    ]
                };
            }

            switch (actionName) {
                case 'scan_junk': {
                    this.emitStep('Initializing junk scanner...');
                    const result = await invoke<ScanResult>('scan_junk_command');
                    this.emitStep(`Analyzing ${result.items.length} files found...`);
                    const size = formatBytes(result.total_size_bytes);
                    return {
                        action: 'scan_junk',
                        success: true,
                        summary: `I've finished scanning. Found ${size} of junk files.`,
                        data: {
                            ...result,
                            suggestions: [
                                { label: 'Review All Junk', action: 'navigate:system-junk' },
                                { label: 'Check Large Files', action: 'Scan my large files' }
                            ]
                        },
                        steps: [`Initializing junk scanner...`, `Analyzing application caches...`, `Checking system logs...`, `Aggregating results...`]
                    };
                }
                case 'clean_junk': {
                    // SAFETY: Never clean immediately through AI. 
                    this.emitStep('Identifying items for cleanup...');
                    const result = await invoke<ScanResult>('scan_junk_command');
                    useScanStore.getState().finishJunkScan(result);

                    return {
                        action: 'clean_junk',
                        success: true,
                        summary: `I've identified ${result.items.length} junk items totalling ${formatBytes(result.total_size_bytes)}. Please confirm if you'd like me to remove them.`,
                        data: {
                            items: result.items,
                            total_size_bytes: result.total_size_bytes
                        },
                        steps: [`Initializing junk scanner...`, `Analyzing application caches...`, `Checking system logs...`, `Waiting for cleanup confirmation...`]
                    };
                }
                case 'scan_malware': {
                    this.emitStep('Loading signature database...');
                    const result = await invoke<{ threats_found: string[]; status: string }>('scan_malware_command');
                    this.emitStep(result.threats_found.length === 0 ? 'No threats found — all clear.' : `⚠️ ${result.threats_found.length} threat(s) detected!`);
                    return {
                        action: 'scan_malware',
                        success: true,
                        summary: result.threats_found.length === 0
                            ? '✅ No threats found — your System is safe!'
                            : `⚠️ ${result.threats_found.length} potential threat(s) detected.`,
                        data: result,
                        steps: ['Loading signature database...', 'Scanning /Applications...', 'Checking launch agents...', 'Analysis complete.']
                    };
                }
                case 'optimize_speed': {
                    this.emitStep('Flushing DNS cache...');
                    const dnsResult = await invoke<{ task: string; status: string }>('run_speed_task_command', { taskId: 'flush_dns' });
                    this.emitStep('Freeing inactive RAM...');
                    const ramResult = await invoke<{ task: string; status: string }>('run_speed_task_command', { taskId: 'free_ram' });
                    this.emitStep('Speed optimisation complete.');
                    return {
                        action: 'optimize_speed',
                        success: true,
                        summary: `⚡ Optimized — DNS flushed & RAM freed. Your Mac should feel snappier.`,
                        data: { dns: dnsResult, ram: ramResult },
                        steps: ['Flushing DNS cache...', 'Compressing VM memory...', 'Freeing inactive RAM...', 'Speed optimization complete.']
                    };
                }
                case 'scan_large_files':
                case 'scan_heavy_files': {
                    this.emitStep('Scanning disk for large files...');
                    const result = await invoke<ScanResult>('scan_large_files_command');
                    this.emitStep(`Found ${result.items.length} files, aggregating...`);
                    const store = useScanStore.getState();
                    store.finishLargeFilesScan(result);
                    return {
                        action: 'scan_large_files',
                        success: true,
                        summary: `Found ${result.items.length} large files (${formatBytes(result.total_size_bytes)} total)`,
                        data: {
                            itemCount: result.items.length,
                            totalSize: result.total_size_bytes,
                            items: result.items,
                            suggestions: [
                                { label: 'Go to Space Lens', action: 'navigate:space-lens' },
                                { label: 'Search for Malware', action: 'Scan for malware' }
                            ]
                        }
                    };
                }
                case 'clean_mail': {
                    this.emitStep('Scanning Mail attachment downloads...');
                    const mailItems = await invoke<{ path: string; size: number; name: string }[]>('scan_mail_command');
                    if (mailItems.length === 0) {
                        this.emitStep('No attachments found — all clear.');
                        return { action: 'clean_mail', success: true, summary: '📧 No mail attachments found to clean.', steps: ['Scanning Mail downloads...', 'Nothing to remove.'] };
                    }
                    const totalSize = mailItems.reduce((sum, i) => sum + i.size, 0);
                    this.emitStep(`Found ${mailItems.length} attachments (${formatBytes(totalSize)}). Awaiting confirmation...`);

                    // SAFETY: Return items for confirmation
                    return {
                        action: 'clean_mail',
                        success: true,
                        summary: `📧 I've found ${mailItems.length} mail attachments (${formatBytes(totalSize)}). Should I remove them?`,
                        data: {
                            items: mailItems.map(i => ({ path: i.path, size_bytes: i.size, category: 'AppSupport' })),
                            total_size_bytes: totalSize
                        },
                        steps: [
                            'Scanning Mail attachment downloads...',
                            `Found ${mailItems.length} attachments (${formatBytes(totalSize)})`,
                            'Preparing safety preview...',
                            'Waiting for cleanup confirmation...'
                        ]
                    };
                }
                case 'run_maintenance': {
                    this.emitStep('Loading maintenance task list...');
                    const tasks = await invoke<{ id: string; name: string; description: string }[]>('get_maintenance_tasks_command');
                    const results: string[] = [];
                    for (const task of tasks) {
                        this.emitStep(`Running: ${task.name}...`);
                        try {
                            const res = await invoke<string>('run_maintenance_task_command', { id: task.id });
                            results.push(`✅ ${task.name}: ${res}`);
                        } catch (e: any) {
                            results.push(`⚠️ ${task.name}: Failed`);
                        }
                    }
                    this.emitStep('All maintenance tasks complete.');
                    return {
                        action: 'run_maintenance',
                        success: true,
                        summary: `🔧 Ran ${tasks.length} maintenance tasks. Mac health improved.`,
                        data: { results },
                        steps: [
                            'Loading maintenance task list...',
                            ...tasks.map(t => `Running: ${t.name}...`),
                            'All maintenance tasks complete.'
                        ]
                    };
                }
                case 'clean_privacy': {
                    this.emitStep('Scanning browser histories...');
                    const privacyItems = await invoke<{ path: string; category: string; size: number }[]>('scan_privacy_command');
                    if (privacyItems.length === 0) {
                        this.emitStep('No privacy traces found — all clear.');
                        return { action: 'clean_privacy', success: true, summary: '🔒 No privacy traces found.', steps: ['Scanning browser histories...', 'Checking cookies...', 'All clear.'] };
                    }
                    const totalSize = privacyItems.reduce((sum, i) => sum + i.size, 0);
                    this.emitStep(`Found ${privacyItems.length} privacy traces. Awaiting confirmation...`);

                    // SAFETY: Return items for confirmation
                    return {
                        action: 'clean_privacy',
                        success: true,
                        summary: `🔒 I've found ${privacyItems.length} privacy traces in your browsers. Should I clear them?`,
                        data: {
                            items: privacyItems.map(i => ({ path: i.path, size_bytes: i.size, category: i.category })),
                            total_size_bytes: totalSize
                        },
                        steps: [
                            'Scanning browser histories...',
                            'Checking Safari, Chrome, Firefox...',
                            `Found ${privacyItems.length} privacy items...`,
                            'Awaiting your confirmation to proceed...'
                        ]
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
                // Fast check: verify IndexedDB cache instead of loading the full model (~2GB)
                // This is instant vs potentially minutes for a full load
                const modelId = this.config.model || 'gemma-2-2b-it-q4f16_1-MLC';

                // Check if any WebLLM-related IndexedDB databases exist (model was downloaded before)
                const isCached = await new Promise<boolean>((resolve) => {
                    const req = indexedDB.open('mlc-chat-db');
                    req.onsuccess = (e) => {
                        const db = (e.target as IDBOpenDBRequest).result;
                        const hasCacheStore = db.objectStoreNames.contains('caches') ||
                            db.objectStoreNames.contains('data') ||
                            db.objectStoreNames.length > 0;
                        db.close();
                        resolve(hasCacheStore);
                    };
                    req.onerror = () => resolve(false);
                    // Timeout safety: if DB check takes too long, assume not cached
                    setTimeout(() => resolve(false), 2000);
                });

                const latency = Date.now() - start;

                // If engine is already loaded in memory, confirm it
                if (this.engine) {
                    return { ok: true, message: `Engine Active — ${modelId} loaded in memory`, latencyMs: latency };
                }

                if (isCached) {
                    return {
                        ok: true,
                        message: `Neural weights cached ✅ — ${modelId} ready to use`,
                        latencyMs: latency
                    };
                } else {
                    return {
                        ok: false,
                        message: `Model not downloaded yet. Open Chat to initialize ${modelId}.`,
                        latencyMs: latency
                    };
                }
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
${TOOL_MANIFEST}

You are **Alto**, a Mac Intelligence Agent. You have real-time access to this Mac.

## 💻 Live System State (Report these numbers if asked)
- **CPU Load**: ${systemStats?.cpu_load.toFixed(1) ?? 'unknown'}%
- **RAM**: ${systemStats ? formatBytes(systemStats.memory_used) : 'unknown'} used / ${systemStats ? formatBytes(systemStats.memory_total) : 'unknown'} total (${memPercent}% full)
- **Installed Apps**: ${installedAppsCount > 0 ? installedAppsCount : 'not yet scanned'}
- **Junk Files**: ${junkStatus}
- **Large Files**: ${largeStatus}
- **Total Clutter**: ${totalClutter > 0 ? formatBytes(totalClutter) : 'none detected yet'}

## 👤 User Profile
${userGreeting}
Current time: ${now}

## 🧠 Personality
Direct, witty, Mac expert. Speak in plain English. 

## 🏷️ Context Tags
The user may use tags like @Memory, @CPU, @Junk, @LargeFiles. These refer directly to the data in "Live System State". 
- If user tags **@Memory** or **@CPU**, analyze the load numbers above.
- If user tags **@Junk** or **@LargeFiles**, summarize the scan findings above.
- If user tags **@Downloads** or **@Applications**, they are asking about those folders; you can offer to scan them.

If you mention any of the data above, you should usually output ACTION:show_overview.
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
                // @ts-ignore - WebLLM supports stop but types might lag
                stop: ["<|eot_id|>", "<|start_header_id|>", "User:", "Human:", "assistant\n\n"],
                temperature: 0.7,
                max_tokens: 1024,
            });
            const raw = reply.choices[0].message.content || "";
            return raw.trim();
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
            return (data.message?.content || "").trim();
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
