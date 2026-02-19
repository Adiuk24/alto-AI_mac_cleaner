import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { aiService, type AIConfig, type TestConnectionResult } from '../services/aiService';
import {
    Save, Cpu, Wifi, WifiOff, Loader2, User, Shield,
    Database, CheckCircle2, ChevronDown, Sparkles, FileText,
    Activity, RefreshCw, Trash2, Download, ArrowUpCircle
} from 'lucide-react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
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

interface ContextStore {
    last_scan_timestamp?: string;
    deletion_history: ContextRecord[];
    system_events: SystemEvent[];
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden backdrop-blur-sm ${className}`}>
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
        <div className={`px-6 py-4 bg-gradient-to-r border-b flex items-center gap-3 ${accents[accent]}`}>
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

    useEffect(() => {
        setConfig(aiService.getConfig());
        // Load user profile
        const saved = localStorage.getItem(USER_PROFILE_KEY);
        if (saved) setProfile(JSON.parse(saved));
        // Load MCP context DIRECTLY from Rust backend (not just cache)
        loadMcpContext();
    }, []);

    const loadMcpContext = async () => {
        try {
            const ctx = await invoke<ContextStore>('get_mcp_context');
            setContextStore(ctx);
            // Also update localStorage cache for the AI
            localStorage.setItem('alto_context_store_cache', JSON.stringify(ctx));
        } catch (e) {
            // Fallback: try localStorage cache
            const cached = localStorage.getItem('alto_context_store_cache');
            if (cached) {
                try { setContextStore(JSON.parse(cached)); } catch { }
            }
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
                    <div className="px-6 py-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border-b border-emerald-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Shield size={16} className="text-emerald-400 opacity-80" />
                            <div>
                                <h3 className="font-semibold text-white text-sm">MCP Safety Layer & Context Store</h3>
                                <p className="text-xs text-white/40 mt-0.5">Live system indexing & event log</p>
                            </div>
                        </div>
                        <button
                            onClick={loadMcpContext}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                        >
                            <RefreshCw size={11} />
                            Refresh
                        </button>
                    </div>
                    <div className="p-6 space-y-5">
                        {/* Live Status Tiles */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-black/20 rounded-xl p-3 border border-white/5 text-center">
                                <StatusBadge active={true} label="Active" />
                                <p className="text-xs text-white/40 mt-2">File Indexer</p>
                                <p className="text-[10px] text-white/25 mt-0.5">Safety gate</p>
                            </div>
                            <div className="bg-black/20 rounded-xl p-3 border border-white/5 text-center">
                                <StatusBadge active={true} label="Live" />
                                <p className="text-xs text-white/40 mt-2">FS Watcher</p>
                                <p className="text-[10px] text-white/25 mt-0.5">/Applications + ~/Downloads</p>
                            </div>
                            <div className="bg-black/20 rounded-xl p-3 border border-white/5 text-center">
                                <StatusBadge active={cleanCount > 0} label={`${cleanCount} cleans`} />
                                <p className="text-xs text-white/40 mt-2">History</p>
                                <p className="text-[10px] text-white/25 mt-0.5">
                                    {totalCleaned > 0 ? `${(totalCleaned / 1024 / 1024).toFixed(1)} MB freed` : 'None yet'}
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
                                                    'bg-white/[0.02] border-white/5'
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
                                            <div key={i} className="flex items-center justify-between px-3 py-2 bg-white/[0.02] rounded-xl border border-white/5 text-xs">
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


                {/* ── AI Engine ── */}
                <SectionCard>
                    <SectionHeader icon={<Cpu size={16} />} title="Intelligence Engine" subtitle="Configure Alto's AI brain" accent="blue" />
                    <div className="p-6 space-y-5">
                        {/* Provider Select */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-white/60 uppercase tracking-wider">AI Provider</label>
                            <div className="relative">
                                <select
                                    value={config.provider}
                                    onChange={(e) => handleChange('provider', e.target.value)}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50 appearance-none transition-all hover:bg-black/40"
                                >
                                    <option value="webllm">🔒 Local (WebLLM) — Best Privacy</option>
                                    <option value="ollama">⚙️ Ollama — Advanced Local</option>
                                    <option value="openai">☁️ OpenAI — Cloud</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30" />
                            </div>
                            <p className="text-xs text-white/30 px-1">WebLLM runs entirely in your browser — no data leaves your Mac.</p>
                        </div>

                        {/* Provider-specific fields */}
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-4">
                            {config.provider === 'ollama' && (
                                <>
                                    <InputField label="Ollama URL" type="text" value={config.baseUrl} onChange={e => handleChange('baseUrl', e.target.value)} placeholder="http://localhost:11434/api/chat" />
                                    <InputField label="Model Tag" type="text" value={config.model} onChange={e => handleChange('model', e.target.value)} placeholder="llama3" />
                                </>
                            )}
                            {config.provider === 'openai' && (
                                <>
                                    <InputField label="API Key" type="password" value={config.apiKey || ''} onChange={e => handleChange('apiKey', e.target.value)} placeholder="sk-..." />
                                    <InputField label="Model Name" type="text" value={config.model} onChange={e => handleChange('model', e.target.value)} placeholder="gpt-4-turbo" />
                                </>
                            )}
                            {config.provider === 'webllm' && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Model Selection</label>
                                    <select
                                        value={config.model}
                                        onChange={e => handleChange('model', e.target.value)}
                                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50"
                                    >
                                        <option value="gemma-2-2b-it-q4f16_1-MLC">Google Gemma 2 (2B) — Fast</option>
                                        <option value="Llama-3-8B-Instruct-q4f32_1-MLC">Meta Llama 3 (8B) — Balanced</option>
                                        <option value="Phi-3-mini-4k-instruct-q4f16_1-MLC">Microsoft Phi 3 — Compact</option>
                                    </select>
                                    <div className="mt-1 text-xs text-amber-300/70 bg-amber-500/8 border border-amber-500/15 p-2.5 rounded-lg">
                                        ⚠️ First run downloads ~2–4 GB of model weights.
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Test Result */}
                        {testResult && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-4 rounded-xl border flex items-center gap-3 ${testResult.ok ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}
                            >
                                {testResult.ok ? <Wifi size={18} className="text-emerald-400 shrink-0" /> : <WifiOff size={18} className="text-red-400 shrink-0" />}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${testResult.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                                        {testResult.ok ? 'Connected' : 'Connection Failed'}
                                    </p>
                                    <p className="text-xs text-white/40 truncate">{testResult.message}</p>
                                </div>
                                {testResult.latencyMs > 0 && <span className="text-xs text-white/30 shrink-0">{testResult.latencyMs}ms</span>}
                            </motion.div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-3 pt-1">
                            <button
                                onClick={handleTestConnection}
                                disabled={isTesting}
                                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm rounded-xl transition-colors disabled:opacity-50"
                            >
                                {isTesting ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                                {isTesting ? 'Testing...' : 'Test Connection'}
                            </button>

                            {config.provider === 'webllm' && (
                                <button
                                    onClick={async () => {
                                        if (confirm('This will delete the local AI model cache (~2-4GB) and re-download it on next use. Continue?')) {
                                            setStatus('Resetting AI Brain...');
                                            await aiService.resetEngineCache();
                                            setStatus('AI Brain Reset Successfully.');
                                            setTimeout(() => setStatus(''), 3000);
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm rounded-xl transition-colors"
                                >
                                    <Trash2 size={14} />
                                    Reset AI Brain
                                </button>
                            )}
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
                                    <p className="text-xs text-white/40">Current Version: v2.1.3</p>
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
