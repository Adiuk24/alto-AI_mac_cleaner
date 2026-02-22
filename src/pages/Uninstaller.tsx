import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Search, Package, AppWindow, ChevronRight, ArrowLeft, AlertTriangle, Clock, Layers } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { formatBytes } from '../utils/formatBytes';
import { playCompletionSound } from '../utils/sounds';

interface AppInfo {
    name: string;
    path: string;
    size_bytes: number;
    bundle_id?: string;
    icon_path?: string;
    store?: string;
    vendor?: string;
    last_used?: number;
}

interface LeftoverGroups {
    logs: string[];
    preferences: string[];
    caches: string[];
    crashes: string[];
    plugins: string[];
    other: string[];
}

const CATEGORY_IDS = ['all', 'unused', 'leftovers', 'suspicious'] as const;
const CATEGORY_NAMES: Record<string, string> = {
    all: 'All Applications',
    unused: 'Unused',
    leftovers: 'Leftovers',
    suspicious: 'Suspicious',
};
const CATEGORY_ICONS = { all: AppWindow, unused: Clock, leftovers: Layers, suspicious: AlertTriangle };

const STORE_IDS = ['appstore', 'setapp', 'steam', 'blizzard', 'other'] as const;
const STORE_NAMES: Record<string, string> = { appstore: 'App Store', setapp: 'Setapp', steam: 'Steam', blizzard: 'Blizzard', other: 'Other' };

function leftoverCount(g: LeftoverGroups): number {
    return g.logs.length + g.preferences.length + g.caches.length + g.crashes.length + g.plugins.length + g.other.length;
}

interface UninstallerProps {
    onNavigate?: (tab: string) => void;
}

export function Uninstaller({ onNavigate }: UninstallerProps) {
    const [apps, setApps] = useState<AppInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeCategory, setActiveCategory] = useState('all');
    const [sortBy, setSortBy] = useState<'name' | 'size'>('size');
    const [leftovers, setLeftovers] = useState<Record<string, LeftoverGroups>>({});
    const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

    useEffect(() => {
        const loadApps = async () => {
            try {
                const data = await invoke<AppInfo[]>('scan_apps_command');
                setApps(data ?? []);
            } catch (e) {
                console.error("Failed to load apps", e);
                setApps([]);
            } finally {
                setLoading(false);
            }
        };
        loadApps();
    }, []);

    // Fetch leftovers when an app is expanded
    const toggleExpand = async (app: AppInfo) => {
        const newExpanded = new Set(expandedApps);
        if (newExpanded.has(app.path)) {
            newExpanded.delete(app.path);
        } else {
            newExpanded.add(app.path);
            if (!leftovers[app.path] && app.bundle_id) {
                try {
                    const groups = await invoke<LeftoverGroups>('scan_leftovers_command', { id: app.bundle_id });
                    setLeftovers(prev => ({ ...prev, [app.path]: groups }));
                } catch (e) {
                    console.error("Failed to scan leftovers", e);
                }
            }
        }
        setExpandedApps(newExpanded);
    };

    const storesWithCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        apps.forEach(app => {
            const s = app.store || 'other';
            counts[s] = (counts[s] || 0) + 1;
        });
        return STORE_IDS.filter(id => (counts[id] ?? 0) > 0).map(id => ({ id, name: STORE_NAMES[id] || id, count: counts[id] ?? 0 }));
    }, [apps]);

    const vendorsWithCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        apps.forEach(app => {
            const v = app.vendor || 'Other';
            counts[v] = (counts[v] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    }, [apps]);

    const categoryCounts = useMemo(() => {
        const all = apps.length;
        const withLeftovers = apps.filter(app => leftovers[app.path] && leftoverCount(leftovers[app.path]) > 0).length;
        const unused = apps.filter(app => app.last_used != null && app.last_used > 0 && (Date.now() / 1000 - app.last_used) > 90 * 24 * 3600).length;
        return { all, unused: unused || 0, leftovers: withLeftovers, suspicious: 0 };
    }, [apps, leftovers]);

    const filteredApps = useMemo(() => {
        let result = apps;

        if (search) {
            result = result.filter(app => app.name.toLowerCase().includes(search.toLowerCase()));
        }

        if (activeCategory === 'unused') {
            result = result.filter(app => app.last_used != null && (Date.now() / 1000 - app.last_used) > 90 * 24 * 3600);
        } else if (activeCategory === 'leftovers') {
            result = result.filter(app => leftovers[app.path] && leftoverCount(leftovers[app.path]) > 0);
        }

        return result.sort((a, b) => {
            if (sortBy === 'size') return b.size_bytes - a.size_bytes;
            return a.name.localeCompare(b.name);
        });
    }, [apps, search, activeCategory, sortBy]);

    const handleToggleSelect = (path: string) => {
        const next = new Set(selectedApps);
        if (next.has(path)) {
            next.delete(path);
        } else {
            next.add(path);
        }
        setSelectedApps(next);
    };

    const handleSelectAll = () => {
        if (selectedApps.size === filteredApps.length) {
            setSelectedApps(new Set());
        } else {
            setSelectedApps(new Set(filteredApps.map(a => a.path)));
        }
    };

    const handleUninstall = async () => {
        if (selectedApps.size === 0) return;
        setIsDeleting(true);
        try {
            const paths = Array.from(selectedApps);
            for (const path of paths) {
                // Try invoke, if safe
                try {
                    await invoke('uninstall_app_command', { path });
                } catch (e) {
                    console.error(`Error uninstalling ${path}`, e);
                }
            }

            setApps(prev => prev.filter(a => !selectedApps.has(a.path)));
            setSelectedApps(new Set());
            playCompletionSound();
        } catch (error) {
            console.error(error);
        } finally {
            setIsDeleting(false);
        }
    };

    const totalSelectedSize = useMemo(() => {
        return apps
            .filter(a => selectedApps.has(a.path))
            .reduce((acc, a) => acc + a.size_bytes, 0);
    }, [apps, selectedApps]);

    return (
        <div className="h-full w-full flex flex-col font-sans overflow-hidden relative bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#020617] text-white">

            {/* Ambient Background Accents ("Soft Aqua") */}
            <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-white/5 backdrop-blur-xl shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => onNavigate?.('dashboard')}
                        className="text-white/70 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                        <ArrowLeft size={18} /> <span className="hidden sm:inline">Back</span>
                    </button>
                    <div className="h-4 w-px bg-white/10" />
                    <div className="text-white/90 font-medium text-sm">Uninstaller</div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-white/60 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search applications..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-black/30 w-56 transition-all focus:w-72"
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden z-10 min-w-0">
                {/* Sidebar - fixed width so it doesn't collapse */}
                <div className="w-64 min-w-[12rem] shrink-0 bg-black/20 border-r border-white/5 flex flex-col backdrop-blur-md overflow-y-auto">
                    <div className="p-4 space-y-6">
                        {/* Categories */}
                        <div>
                            {CATEGORY_IDS.map(id => {
                                const Icon = CATEGORY_ICONS[id];
                                const isActive = activeCategory === id;
                                const count = categoryCounts[id];
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => setActiveCategory(id)}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all mb-1 group relative ${isActive
                                            ? 'text-white font-medium bg-white/10 border border-white/10 shadow-sm'
                                            : 'text-white/60 hover:bg-white/5 hover:text-white/90 border border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 relative z-10">
                                            <Icon size={16} className={isActive ? "text-cyan-300" : "text-white/40 group-hover:text-white/60"} />
                                            <span>{CATEGORY_NAMES[id]}</span>
                                        </div>
                                        <span className={`text-xs tabular-nums ${isActive ? "text-cyan-200" : "text-white/40 group-hover:text-white/60"}`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div>
                            <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-3 px-3">Stores</h3>
                            {storesWithCounts.map(store => (
                                <button
                                    key={store.id}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-white/50 hover:bg-white/5 hover:text-white/80 transition-all mb-1"
                                >
                                    <span>{store.name}</span>
                                    <span className="opacity-30">{store.count}</span>
                                </button>
                            ))}
                        </div>

                        <div>
                            <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-3 px-3">Vendors</h3>
                            {vendorsWithCounts.slice(0, 8).map(v => (
                                <button
                                    key={v.name}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-white/50 hover:bg-white/5 hover:text-white/80 transition-all mb-1"
                                >
                                    <span>{v.name}</span>
                                    <span className="opacity-30">{v.count}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col relative">
                    {/* List Header */}
                    <div className="p-8 pb-4">
                        <div className="flex items-end justify-between mb-2">
                            <div>
                                <h1 className="text-3xl font-light text-white mb-2 tracking-tight">
                                    {CATEGORY_NAMES[activeCategory] ?? 'Applications'}
                                </h1>
                                <p className="text-white/50 text-sm max-w-xl">
                                    {activeCategory === 'all'
                                        ? "All of the applications installed on your Mac are presented below."
                                        : "Review and remove specific applications."}
                                </p>
                            </div>

                            <button
                                onClick={() => setSortBy(prev => prev === 'name' ? 'size' : 'name')}
                                className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-1 bg-cyan-950/30 px-3 py-1.5 rounded-full border border-cyan-500/20"
                            >
                                Sort by {sortBy === 'name' ? 'Name' : 'Size'}
                                <ChevronRight size={12} className="rotate-90" />
                            </button>
                        </div>
                    </div>

                    {/* Column Headers */}
                    <div className="px-8 pb-2 flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-white/30 border-b border-white/5 mx-6">
                        <div className="w-8 flex justify-center">
                            <button onClick={handleSelectAll} className="hover:text-white transition-colors">
                                {selectedApps.size > 0 && selectedApps.size === filteredApps.length ? 'None' : 'All'}
                            </button>
                        </div>
                        <div className="flex-1 pl-2">Application</div>
                        <div className="w-24 text-right">Size</div>
                        <div className="w-6"></div>
                    </div>

                    {/* Scrollable List */}
                    <div className="flex-1 overflow-y-auto px-6 py-2 pb-32 custom-scrollbar">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-3">
                                <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                                <span className="text-white/30 text-xs uppercase tracking-widest">Scanning Apps...</span>
                            </div>
                        ) : filteredApps.length === 0 ? (
                            <div className="text-center py-20 px-4">
                                <Package size={48} className="mx-auto text-white/10 mb-4" />
                                <div className="text-white/70 text-sm font-medium">No applications found</div>
                                <p className="text-white/40 text-xs mt-2 max-w-sm mx-auto">
                                    Grant Full Disk Access in System Settings so Alto can list applications from /Applications and your user Applications folder.
                                </p>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await invoke('open_full_disk_access_settings_command');
                                        } catch (e) {
                                            console.error(e);
                                        }
                                    }}
                                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white/90 text-sm font-medium transition-colors"
                                >
                                    Open System Settings → Privacy & Security
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredApps.map(app => {
                                    const isSelected = selectedApps.has(app.path);
                                    return (
                                        <div
                                            key={app.path}
                                            onClick={() => handleToggleSelect(app.path)}
                                            className={`group flex items-center gap-4 py-3 px-4 rounded-xl cursor-pointer border transition-all duration-200 relative overflow-hidden ${isSelected
                                                ? 'bg-cyan-900/20 border-cyan-500/30 shadow-lg shadow-black/20'
                                                : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05] hover:border-white/10'
                                                }`}
                                        >
                                            {/* Selection Highlight Bar */}
                                            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400" />}

                                            {/* Checkbox */}
                                            <div className="w-8 flex justify-center shrink-0 z-10">
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-300 ${isSelected
                                                    ? 'bg-gradient-to-br from-cyan-400 to-blue-500 border-transparent scale-110'
                                                    : 'border-white/20 group-hover:border-white/40 bg-black/20'
                                                    }`}>
                                                    {isSelected && <div className="w-2 h-2 bg-white rounded-full shadow-sm" />}
                                                </div>
                                            </div>

                                            {/* App Icon (Placeholder or Real) */}
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center relative shrink-0">
                                                {/* In real implementation, this would be an <img src={convertFileSrc(app.icon)} /> */}
                                                <div className={`absolute inset-0 rounded-lg ${isSelected ? 'bg-cyan-500/20' : 'bg-white/10'}`} />
                                                <Package className={isSelected ? "text-cyan-300 relative z-10" : "text-white/40 relative z-10"} size={20} />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0 z-10 pl-2">
                                                <div className={`font-medium text-sm truncate transition-colors ${isSelected ? 'text-white' : 'text-white/90'}`}>
                                                    {app.name}
                                                </div>
                                                <div className="text-xs text-white/30 truncate flex items-center gap-2">
                                                    <span>{app.bundle_id?.split('.')[1] || 'App'}</span>
                                                    {leftovers[app.path] && leftoverCount(leftovers[app.path]) > 0 && (
                                                        <span className="bg-cyan-500/10 text-cyan-300 px-1.5 rounded text-[10px] font-medium border border-cyan-500/20">
                                                            +{leftoverCount(leftovers[app.path])} items
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Expanded Details: per-app resource groups */}
                                                <AnimatePresence>
                                                    {expandedApps.has(app.path) && leftovers[app.path] && (() => {
                                                        const g = leftovers[app.path];
                                                        const sections = [
                                                            { label: 'Logs', paths: g.logs },
                                                            { label: 'Preferences', paths: g.preferences },
                                                            { label: 'Caches', paths: g.caches },
                                                            { label: 'Crashes', paths: g.crashes },
                                                            { label: 'Plugins', paths: g.plugins },
                                                            { label: 'Other', paths: g.other },
                                                        ].filter(s => s.paths.length > 0);
                                                        if (sections.length === 0) return null;
                                                        return (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: "auto", opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="overflow-hidden mt-2 space-y-2"
                                                            >
                                                                {sections.map(({ label, paths }) => (
                                                                    <div key={label}>
                                                                        <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1">{label}</div>
                                                                        {paths.slice(0, 5).map((p, i) => (
                                                                            <div key={i} className="flex items-center gap-2 text-[10px] text-white/40 pl-2 border-l border-white/10">
                                                                                <Layers size={10} />
                                                                                <span className="truncate">{p.split('/').pop() || p}</span>
                                                                            </div>
                                                                        ))}
                                                                        {paths.length > 5 && <div className="text-[10px] text-white/30 pl-2">+{paths.length - 5} more</div>}
                                                                    </div>
                                                                ))}
                                                            </motion.div>
                                                        );
                                                    })()}
                                                </AnimatePresence>
                                            </div>

                                            {/* Size */}
                                            <div className={`w-24 text-right text-sm font-mono transition-colors z-10 ${isSelected ? 'text-cyan-200' : 'text-white/40 group-hover:text-white/60'}`}>
                                                {formatBytes(app.size_bytes)}
                                            </div>

                                            {/* Arrow / Chevron */}
                                            <div
                                                className="w-6 flex justify-center text-white/10 group-hover:text-white/40 z-10 cursor-pointer hover:text-white"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleExpand(app);
                                                }}
                                            >
                                                <ChevronRight
                                                    size={16}
                                                    className={`transition-transform duration-200 ${expandedApps.has(app.path) ? 'rotate-90' : ''}`}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Floating Action Bar */}
                    <AnimatePresence>
                        {selectedApps.size > 0 && (
                            <motion.div
                                initial={{ y: 100, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 100, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#1e1e2e]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/80 p-2 pr-6 flex items-center gap-5 z-30 min-w-[320px]"
                            >
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
                                    <Trash2 size={20} className="text-white" />
                                </div>

                                <div className="flex flex-col flex-1 mr-4">
                                    <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Ready to Uninstall</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-lg font-bold text-white">{selectedApps.size}</span>
                                        <span className="text-sm text-cyan-200 font-medium">{formatBytes(totalSelectedSize)}</span>
                                    </div>
                                </div>

                                <div className="h-8 w-px bg-white/10 mx-2" />

                                <button
                                    onClick={handleUninstall}
                                    disabled={isDeleting}
                                    className="bg-white text-[#0f172a] hover:bg-cyan-50 px-8 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap"
                                >
                                    {isDeleting ? 'Uninstalling...' : 'Uninstall'}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
