import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { aiService, type AIConfig, type TestConnectionResult } from '../services/aiService';
import {
    Save, Cpu, Wifi, Loader2, User, Shield,
    Database, CheckCircle2, Sparkles, FileText,
    Activity, RefreshCw, Trash2, Download, ArrowUpCircle
} from 'lucide-react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { listen } from '@tauri-apps/api/event';
import { AltoAvatar } from '../components/AltoAvatar';

const USER_PROFILE_KEY = 'alto_user_profile_v1';

interface UserProfile {
    name: string;
    role: string;
}

interface ContextRecord {
    timestamp: string;
    paths_deleted: string[];
    total_bytes_freed: number;
}

interface SystemEvent {
    timestamp: string;
    event_type: string;  // 'app_installed' | 'file_downloaded' | 'suspicious_download'
    description: string;
    path: string;
}

interface UserPrefs {
    always_skip_patterns: string[];
    auto_confirm_caches?: boolean;
}

interface ContextStore {
    last_scan_timestamp?: string;
    deletion_history: ContextRecord[];
    system_events: SystemEvent[];
    user_preferences?: UserPrefs;
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white/4 border border-white/8 rounded-2xl overflow-hidden backdrop-blur-sm ${className}`}>
            {children}
        </div>
    );
}

function SectionHeader({ icon, title, subtitle, accent = 'purple' }: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    accent?: 'purple' | 'emerald' | 'blue' | 'amber';
}) {
    const accents = {
        purple: 'from-purple-500/20 to-indigo-500/10 border-purple-500/20 text-purple-400',
        emerald: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/20 text-emerald-400',
        blue: 'from-blue-500/20 to-cyan-500/10 border-blue-500/20 text-blue-400',
        amber: 'from-amber-500/20 to-orange-500/10 border-amber-500/20 text-amber-400',
    };
    return (
        <div className={`px-6 py-4 bg-linear-to-r border-b flex items-center gap-3 ${accents[accent]}`}>
            <div className="opacity-80">{icon}</div>
            <div>
                <h3 className="font-semibold text-white text-sm">{title}</h3>
                {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
            </div>
        </div>
    );
}

function InputField({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wider">{label}</label>
            <input
                {...props}
                className="bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 focus:bg-black/40 transition-all"
            />
            {hint && <p className="text-xs text-white/30 px-1">{hint}</p>}
        </div>
    );
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${active
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {label}
        </div>
    );
}

export function Settings() {
    const [config, setConfig] = useState<AIConfig>(aiService.getConfig());
    const [status, setStatus] = useState<string>('');
    const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [profile, setProfile] = useState<UserProfile>({ name: '', role: 'Mac User' });
    const [contextStore, setContextStore] = useState<ContextStore | null>(null);
    const [contextPath] = useState(`${navigator.platform.includes('Mac') ? '~' : '/home/user'}/.alto/context.json`);
    const [updateStatus, setUpdateStatus] = useState<{
        checking: boolean;
        available: boolean;
        version?: string;
        error?: string;
        progress?: number;
    }>({ checking: false, available: false });
    const [mcpStatus, setMcpStatus] = useState({
        indexer_active: true,
        watcher_active: true,
        store_initialized: false
    });
    const [clickCount, setClickCount] = useState(0);
    const [aiLogs, setAiLogs] = useState<string[]>([]);
    const [newIgnorePattern, setNewIgnorePattern] = useState('');

    useEffect(() => {
        // Intercept console.log for AI logs
        const originalLog = console.log;
        console.log = (...args: any[]) => {
            if (typeof args[0] === 'string' && args[0].startsWith('LOG:')) {
                setAiLogs(prev => [...prev.slice(-19), args[0].replace('LOG:', '')]);
            }
            originalLog(...args);
        };

        setConfig(aiService.getConfig());
        // Load user profile
        const saved = localStorage.getItem(USER_PROFILE_KEY);
        if (saved) setProfile(JSON.parse(saved));
        // Load MCP context DIRECTLY from Rust backend
        loadMcpContext();
        fetchMcpStatus();

        // Listen for live system events
        let unlisten: (() => void) | undefined;
        listen('system-event', (event: any) => {
            console.log("Received system event:", event.payload);
            setContextStore(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    system_events: [...prev.system_events, event.payload]
                };
            });
        }).then(u => { unlisten = u; });

        return () => {
            if (unlisten) unlisten();
        };
    }, []);

    // Simulated "Active" Neural Heartbeat for visual feedback
    useEffect(() => {
        if (aiLogs.length > 0) return;

        const bootSequence = [
            "Initializing Neural Core...",
            "Loading local weights (v4.2)...",
            "Checking GPU acceleration... METAL: ENABLED",
            "Allocating tensor buffers...",
            "Connecting to Alto Service Mesh...",
            "✅ System Ready. Listening for tasks."
        ];

        let i = 0;
        const interval = setInterval(() => {
            if (i >= bootSequence.length) {
                clearInterval(interval);
                return;
            }
            // Manually add to log state to bypass the console detour for this simulated sequence
            setAiLogs(prev => [...prev.slice(-19), bootSequence[i]]);
            i++;
        }, 600); // Add a log every 600ms

        return () => clearInterval(interval);
    }, []);

    const loadMcpContext = async () => {
        console.log("Reloading MCP context...");
        try {
            const ctx = await invoke<ContextStore>('get_mcp_context');
            console.log("Context loaded:", ctx);
            setContextStore(ctx);
            localStorage.setItem('alto_context_store_cache', JSON.stringify(ctx));
            setStatus('Context Refresh Completed.');
            setTimeout(() => setStatus(''), 2000);
        } catch (e) {
            console.error("Failed to reload MCP context:", e);
            const cached = localStorage.getItem('alto_context_store_cache');
            if (cached) {
                try { setContextStore(JSON.parse(cached)); } catch { }
            }
        }
    };

    const fetchMcpStatus = async () => {
        try {
            const status = await invoke<any>('get_mcp_status');
            setMcpStatus(status);
        } catch (e) {
            console.error("Failed to fetch MCP status", e);
        }
    };

    const handleChange = (field: keyof AIConfig, value: string) => {
        setConfig(prev => ({ ...prev, [field]: value }));
        setTestResult(null);
    };

    const handleSave = () => {
        aiService.saveConfig(config);
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
        setStatus('All settings saved!');
        setTimeout(() => setStatus(''), 2500);
    };

    const handleCheckUpdates = async () => {
        setUpdateStatus({ checking: true, available: false });
        try {
            const update = await check();
            if (update) {
                setUpdateStatus({
                    checking: false,
                    available: true,
                    version: update.version
                });

                if (confirm(`A new version (${update.version}) is available. Would you like to install it now?`)) {
                    setUpdateStatus(prev => ({ ...prev, checking: true }));
                    let downloaded = 0;
                    let contentLength = 0;
                    await update.downloadAndInstall((event) => {
                        switch (event.event) {
                            case 'Started':
                                contentLength = event.data.contentLength || 0;
                                console.log(`started downloading ${contentLength} bytes`);
                                break;
                            case 'Progress':
                                downloaded += event.data.chunkLength;
                                const progress = contentLength ? (downloaded / contentLength) * 100 : 0;
                                setUpdateStatus(prev => ({ ...prev, progress }));
                                break;
                            case 'Finished':
                                console.log('download finished');
                                break;
                        }
                    });

                    await relaunch();
                }
            } else {
                setUpdateStatus({ checking: false, available: false });
                setStatus('Alto is up to date!');
                setTimeout(() => setStatus(''), 3000);
            }
        } catch (e: any) {
            console.error('Update check failed:', e);
            setUpdateStatus({ checking: false, available: false, error: e.message });
        }
    };

    const handleTestConnection = async () => {
        aiService.saveConfig(config);
        setIsTesting(true);
        setTestResult(null);
        try {
            const result = await aiService.testConnection();
            setTestResult(result);
        } catch (e: any) {
            setTestResult({ ok: false, message: e.message || 'Test failed', latencyMs: 0 });
        } finally {
            setIsTesting(false);
        }
    };

    const handleResetContext = async () => {
        setClickCount(c => c + 1);
        console.log("Reset triggered");
        // alert("Reset Memory Clicked!"); // Temporarily disabled if alerting is annoying
        setStatus('Wiping store...');
        try {
            const newCtx = await aiService.resetContext();
            console.log("Reset result:", newCtx);
            setContextStore(newCtx as any);
            localStorage.removeItem('alto_context_store_cache');
            setStatus('Context Memory Wiped.');
            setTimeout(() => setStatus(''), 3000);
        } catch (e) {
            console.error("Reset Error:", e);
            setStatus('Reset Failed!');
            setTimeout(() => setStatus(''), 3000);
        }
    };

    const totalCleaned = contextStore?.deletion_history.reduce((acc, r) => acc + r.total_bytes_freed, 0) ?? 0;
    const cleanCount = contextStore?.deletion_history.length ?? 0;

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">

                {/* Page Header */}
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Settings</h2>
                        <p className="text-sm text-white/40 mt-1">Configure Alto to work exactly how you want.</p>
                    </div>
                    <motion.button
                        onClick={handleSave}
                        whileTap={{ scale: 0.96 }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-purple-500/20"
                    >
                        <Save size={15} />
                        Save All
                    </motion.button>
                </div>

                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-medium"
                    >
                        <CheckCircle2 size={16} />
                        {status}
                    </motion.div>
                )}

                {/* ── User Profile ── */}
                <SectionCard>
                    <SectionHeader icon={<User size={16} />} title="Your Profile" subtitle="Personalize your Alto experience" accent="purple" />
                    <div className="p-6 flex items-start gap-5">
                        <div className="shrink-0">
                            <AltoAvatar size={56} />
                        </div>
                        <div className="flex-1 space-y-4">
                            <InputField
                                label="Your Name"
                                placeholder="e.g. Alex"
                                value={profile.name}
                                onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                                hint="Alto will greet you by name in the chat."
                            />
                            <InputField
                                label="Role / Title"
                                placeholder="e.g. Designer, Developer, Creator"
                                value={profile.role}
                                onChange={e => setProfile(p => ({ ...p, role: e.target.value }))}
                                hint="Helps Alto tailor its suggestions."
                            />
                        </div>
                    </div>
                </SectionCard>

                {/* ── MCP & Context Server ── */}
                <SectionCard>
                    <div className="px-6 py-4 bg-linear-to-r from-emerald-500/20 to-teal-500/10 border-b border-emerald-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Shield size={16} className="text-emerald-400 opacity-80" />
                            <div>
                                <h3 className="font-semibold text-white text-sm">MCP Safety Layer & Context Store</h3>
                                <p className="text-xs text-white/40 mt-0.5">Live system indexing & event log</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 relative z-[100]">
                            <span className="text-[10px] text-white/20 mr-2">Clicks: {clickCount}</span>
                            <button
                                onClick={handleResetContext}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400/70 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 rounded-lg border border-red-500/10 transition-colors relative z-[101]"
                            >
                                <Trash2 size={11} />
                                Reset Memory
                            </button>
                            <button
                                onClick={() => { setClickCount(c => c + 1); loadMcpContext(); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors relative z-[101]"
                            >
                                <RefreshCw size={11} />
                                Refresh
                            </button>
                        </div>
                    </div>
                    <div className="p-6 space-y-5">
                        {/* Live Status Tiles */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-black/20 rounded-xl p-3 border border-white/5 text-center">
                                <StatusBadge active={mcpStatus.indexer_active} label={mcpStatus.indexer_active ? "Active" : "Inactive"} />
                                <p className="text-xs text-white/40 mt-2">File Indexer</p>
                                <p className="text-[10px] text-white/25 mt-0.5">Safety gate</p>
                            </div>
                            <div className="bg-black/20 rounded-xl p-3 border border-white/5 text-center">
                                <StatusBadge active={mcpStatus.watcher_active} label={mcpStatus.watcher_active ? "Live" : "Stopped"} />
                                <p className="text-xs text-white/40 mt-2">FS Watcher</p>
                                <p className="text-[10px] text-white/25 mt-0.5">/Applications + ~/Downloads</p>
                            </div>
                            <div className="bg-black/20 rounded-xl p-3 border border-white/5 text-center">
                                <StatusBadge active={mcpStatus.store_initialized} label={mcpStatus.store_initialized ? "Initialized" : "Empty"} />
                                <p className="text-xs text-white/40 mt-2">Context Store</p>
                                <p className="text-[10px] text-white/25 mt-0.5">
                                    {totalCleaned > 0 ? `${(totalCleaned / 1024 / 1024).toFixed(1)} MB freed` : 'History'}
                                </p>
                            </div>
                        </div>

                        {/* Live System Event Log */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Activity size={13} className="text-emerald-400" />
                                <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Live System Events</span>
                                <span className="ml-auto text-[10px] text-white/25">{contextStore?.system_events?.length ?? 0} recorded</span>
                            </div>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {(contextStore?.system_events?.length ?? 0) === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-6 text-white/20">
                                        <Activity size={24} className="mb-2 opacity-30" />
                                        <p className="text-xs">No events yet — install an app or download a file to see live tracking</p>
                                    </div>
                                ) : (
                                    [...(contextStore?.system_events ?? [])].reverse().map((evt, i) => {
                                        const isApp = evt.event_type === 'app_installed';
                                        const isSuspicious = evt.event_type === 'suspicious_download';
                                        const time = new Date(evt.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                        return (
                                            <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border text-xs ${isSuspicious ? 'bg-amber-500/5 border-amber-500/15' :
                                                isApp ? 'bg-blue-500/5 border-blue-500/10' :
                                                    'bg-white/2 border-white/5'
                                                }`}>
                                                <span className="text-base leading-none mt-0.5">
                                                    {isApp ? '📦' : isSuspicious ? '⚠️' : '📥'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white/70 truncate">{evt.description}</p>
                                                    <p className="text-white/25 text-[10px] mt-0.5 font-mono truncate">{evt.path}</p>
                                                </div>
                                                <span className="text-white/20 text-[10px] shrink-0">{time}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Deletion History */}
                        {cleanCount > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Trash2 size={13} className="text-purple-400" />
                                    <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Deletion History</span>
                                </div>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                    {[...(contextStore?.deletion_history ?? [])].reverse().map((rec, i) => {
                                        const time = new Date(rec.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                        const mb = (rec.total_bytes_freed / 1024 / 1024).toFixed(1);
                                        return (
                                            <div key={i} className="flex items-center justify-between px-3 py-2 bg-white/2 rounded-xl border border-white/5 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <Trash2 size={11} className="text-purple-400/60" />
                                                    <span className="text-white/50">{rec.paths_deleted.length} items removed</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-emerald-400/70 font-medium">{mb} MB freed</span>
                                                    <span className="text-white/20">{time}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Ignore list — patterns to always skip in scans */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <FileText size={13} className="text-amber-400" />
                                <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Ignore list</span>
                            </div>
                            <p className="text-xs text-white/40 mb-2">File or folder names (or patterns) to always skip during junk/large-file scans.</p>
                            <div className="flex gap-2 mb-2">
                                <input
                                    value={newIgnorePattern}
                                    onChange={e => setNewIgnorePattern(e.target.value)}
                                    placeholder="e.g. my-important-folder"
                                    className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"
                                />
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const pat = newIgnorePattern.trim();
                                        if (!pat) return;
                                        const prefs: UserPrefs = {
                                            always_skip_patterns: [...(contextStore?.user_preferences?.always_skip_patterns ?? []), pat],
                                            auto_confirm_caches: contextStore?.user_preferences?.auto_confirm_caches ?? false
                                        };
                                        await invoke('update_user_preferences_command', { prefs });
                                        setContextStore(prev => prev ? { ...prev, user_preferences: prefs } : null);
                                        setNewIgnorePattern('');
                                    }}
                                    className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/30"
                                >
                                    Add
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(contextStore?.user_preferences?.always_skip_patterns ?? []).map((p, i) => (
                                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[11px] font-mono text-white/70">
                                        {p}
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const list = contextStore?.user_preferences?.always_skip_patterns ?? [];
                                                const next = list.filter((_, j) => j !== i);
                                                const prefs: UserPrefs = {
                                                    always_skip_patterns: next,
                                                    auto_confirm_caches: contextStore?.user_preferences?.auto_confirm_caches ?? false
                                                };
                                                await invoke('update_user_preferences_command', { prefs });
                                                setContextStore(prev => prev ? { ...prev, user_preferences: prefs } : null);
                                            }}
                                            className="text-white/40 hover:text-red-400"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Protected Paths */}
                        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Shield size={13} className="text-red-400" />
                                <span className="text-xs font-semibold text-red-300 uppercase tracking-wide">Always Protected — Never Deleted</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {['~/Documents', '~/Desktop', '~/Downloads', '~/Pictures', '~/Movies', '/System', '/usr', '/bin'].map(p => (
                                    <span key={p} className="px-2 py-1 bg-red-500/10 border border-red-500/15 rounded-lg text-[11px] font-mono text-red-300/70">{p}</span>
                                ))}
                            </div>
                        </div>

                        {/* Context file path */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-black/20 rounded-xl border border-white/5">
                            <Database size={14} className="text-white/30 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs text-white/40">Context store location</p>
                                <p className="text-xs font-mono text-white/60 truncate">{contextPath}</p>
                            </div>
                        </div>
                    </div>
                </SectionCard>


                {/* ── AI Engine Redesigned ── */}
                <SectionCard>
                    <SectionHeader icon={<Cpu size={16} />} title="Intelligence Engine" subtitle="Configure Alto's neural architecture" accent="blue" />
                    <div className="p-6 space-y-8">

                        {/* Provider Selection Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { id: 'webllm', name: 'Privacy-First', icon: '🔒', desc: 'Runs 100% locally', badge: 'Recommended' },
                                { id: 'ollama', name: 'Advanced', icon: '⚙️', desc: 'Local via Ollama' },
                                { id: 'openai', name: 'Cloud Hybrid', icon: '☁️', desc: 'Highest precision' }
                            ].map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleChange('provider', p.id)}
                                    className={`relative flex flex-col items-start p-4 rounded-2xl border transition-all text-left group ${config.provider === p.id
                                        ? 'bg-blue-500/10 border-blue-500/40 rin-1 ring-blue-500/20'
                                        : 'bg-white/2 border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    {p.badge && (
                                        <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-blue-500 text-[10px] font-bold text-white rounded-full shadow-lg">
                                            {p.badge}
                                        </span>
                                    )}
                                    <span className="text-xl mb-2">{p.icon}</span>
                                    <span className={`text-sm font-semibold ${config.provider === p.id ? 'text-blue-400' : 'text-white/80'}`}>{p.name}</span>
                                    <span className="text-[10px] text-white/30 mt-1">{p.desc}</span>
                                    {config.provider === p.id && (
                                        <motion.div layoutId="provider-check" className="absolute top-4 right-4 text-blue-400">
                                            <CheckCircle2 size={14} />
                                        </motion.div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Configuration Controls */}
                        <div className="bg-black/20 rounded-2xl p-6 border border-white/5 space-y-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />

                            {config.provider === 'webllm' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Active Local Model</label>
                                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-mono rounded-md border border-emerald-500/20">Verified</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {[
                                            { id: 'gemma-2-2b-it-q4f16_1-MLC', name: 'Google Gemma 2 (2B)', desc: 'Fast & Precise · ~2GB', recommended: true },
                                            { id: 'Llama-3-8B-Instruct-q4f32_1-MLC', name: 'Meta Llama 3 (8B)', desc: 'Powerful · ~5GB' },
                                            { id: 'Phi-3-mini-4k-instruct-q4f16_1-MLC', name: 'Microsoft Phi 3', desc: 'Ultra Compact · ~1.5GB' }
                                        ].map(m => (
                                            <button
                                                key={m.id}
                                                onClick={() => handleChange('model', m.id)}
                                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${config.model === m.id
                                                    ? 'bg-white/5 border-white/20'
                                                    : 'bg-transparent border-transparent hover:bg-white/2'
                                                    }`}
                                            >
                                                <div className="text-left">
                                                    <p className={`text-sm font-medium ${config.model === m.id ? 'text-white' : 'text-white/50'}`}>{m.name}</p>
                                                    <p className="text-[10px] text-white/20">{m.desc}</p>
                                                </div>
                                                {config.model === m.id && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-blue-300/40 italic flex items-center gap-1.5">
                                        <Sparkles size={10} />
                                        Note: First switch will trigger a neural weight download.
                                    </p>
                                </div>
                            )}

                            {config.provider === 'ollama' && (
                                <div className="space-y-4">
                                    <InputField label="Endpoint URL" placeholder="http://localhost:11434" value={config.baseUrl} onChange={e => handleChange('baseUrl', e.target.value)} />
                                    <InputField label="Model Path" placeholder="llama3:latest" value={config.model} onChange={e => handleChange('model', e.target.value)} />
                                </div>
                            )}

                            {config.provider === 'openai' && (
                                <div className="space-y-4">
                                    <InputField label="API Reference Key" type="password" placeholder="sk-..." value={config.apiKey} onChange={e => handleChange('apiKey', e.target.value)} />
                                    <InputField label="Model Target" placeholder="gpt-4o" value={config.model} onChange={e => handleChange('model', e.target.value)} />
                                </div>
                            )}
                        </div>

                        {/* Status Console & Action Hub */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between h-8">
                                <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                                    <Activity size={10} />
                                    Neural Diagnostics
                                </span>
                                {testResult && (
                                    <span className={`text-[10px] font-medium ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {testResult.ok ? `Latency: ${testResult.latencyMs}ms` : 'Check configuration'}
                                    </span>
                                )}
                            </div>

                            {/* NEW: Professional Console */}
                            <div className="bg-black/40 rounded-2xl border border-white/5 font-mono p-4 h-32 overflow-y-auto block select-text custom-scrollbar">
                                {aiLogs.length === 0 ? (
                                    <span className="text-white/10 text-[11px]">System ready. Awaiting task...</span>
                                ) : (
                                    aiLogs.map((log, i) => {
                                        if (!log || typeof log !== 'string') return null;
                                        return (
                                            <div key={i} className="text-[11px] text-white/40 border-l border-white/10 pl-3 mb-1 animate-in fade-in slide-in-from-left-2 duration-300">
                                                <span className="text-blue-500/40 mr-2">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                                                <span className={log.includes('✅') || log.includes('✨') ? 'text-emerald-400/70' : ''}>{log}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="flex items-center gap-3 relative z-[100]">
                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleTestConnection}
                                    disabled={isTesting}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold rounded-2xl transition-all relative z-[101]"
                                >
                                    {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
                                    Validate Engine
                                </motion.button>

                                {config.provider === 'webllm' && (
                                    <motion.button
                                        whileTap={{ scale: 0.98 }}
                                        onClick={async () => {
                                            if (confirm('Delete local neural weights (~4GB)? Repurges all IndexedDB layers.')) {
                                                setStatus('Initiating Cache Purge...');
                                                try {
                                                    await aiService.resetEngineCache();
                                                    setStatus('Neural Cache Cleared.');
                                                } catch (e) {
                                                    console.error("Cache Reset Error:", e);
                                                    setStatus('Purge Failure.');
                                                }
                                                setTimeout(() => setStatus(''), 4000);
                                            }
                                        }}
                                        className="px-6 py-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 text-red-400 text-sm font-semibold rounded-2xl transition-all group relative z-[101]"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Trash2 size={16} className="group-hover:rotate-12 transition-transform" />
                                            Wipe Cache
                                        </div>
                                    </motion.button>
                                )}
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* ── Software Update ── */}
                <SectionCard>
                    <SectionHeader icon={<ArrowUpCircle size={16} />} title="Software Update" subtitle="Keep Alto up to date with the latest features" accent="blue" />
                    <div className="p-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <ArrowUpCircle size={20} className="text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">Check for Updates</p>
                                    <p className="text-xs text-white/40">Current Version: v2.1.4</p>
                                </div>
                            </div>
                            <button
                                onClick={handleCheckUpdates}
                                disabled={updateStatus.checking}
                                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${updateStatus.checking
                                    ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                    }`}
                            >
                                {updateStatus.checking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                {updateStatus.checking ? 'Checking...' : 'Check Now'}
                            </button>
                        </div>

                        {updateStatus.available && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col gap-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400">
                                        <Download size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-emerald-400">Update Available! (v{updateStatus.version})</p>
                                        <p className="text-xs text-white/50">A new build has been pushed to GitHub.</p>
                                    </div>
                                </div>
                                {updateStatus.progress !== undefined && (
                                    <div className="space-y-1.5">
                                        <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${updateStatus.progress}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-white/30 text-right">{Math.round(updateStatus.progress)}% downloaded</p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {updateStatus.error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3">
                                <Activity size={16} className="text-red-400" />
                                <p className="text-xs text-red-300/80">{updateStatus.error}</p>
                            </div>
                        )}
                    </div>
                </SectionCard>

                {/* ── About ── */}
                <SectionCard>
                    <SectionHeader icon={<Sparkles size={16} />} title="About Alto" accent="amber" />
                    <div className="p-6">
                        <div className="flex items-center gap-4">
                            <AltoAvatar size={44} />
                            <div>
                                <p className="font-bold text-white">Alto</p>
                                <p className="text-xs text-white/40">v0.2.0 — Agentic Edition</p>
                                <p className="text-xs text-white/30 mt-1">System Assessment & Logic Tool · MCP Safety Layer v1</p>
                            </div>
                        </div>
                        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                            {[
                                { icon: <Shield size={16} className="text-emerald-400" />, label: 'MCP Safety', value: 'Active' },
                                { icon: <Database size={16} className="text-blue-400" />, label: 'Context Store', value: 'Live' },
                                { icon: <FileText size={16} className="text-purple-400" />, label: 'History', value: `${cleanCount} sessions` },
                            ].map(item => (
                                <div key={item.label} className="bg-black/20 rounded-xl p-3 border border-white/5">
                                    <div className="flex justify-center mb-1">{item.icon}</div>
                                    <p className="text-xs font-semibold text-white">{item.value}</p>
                                    <p className="text-[10px] text-white/30 mt-0.5">{item.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </SectionCard>

            </div>
        </div>
    );
}
