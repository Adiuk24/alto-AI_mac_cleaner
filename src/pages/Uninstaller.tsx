import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Search, Package, AppWindow, ChevronRight, ArrowLeft } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { formatBytes } from '../utils/formatBytes';
import { playCompletionSound } from '../utils/sounds';

interface AppInfo {
    name: string;
    path: string;
    size_bytes: number;
    bundle_id?: string; // Optional if we add it to backend later
}

// Mock categories for UI demonstration
const CATEGORIES = [
    { id: 'all', name: 'All Applications', icon: AppWindow, count: 0 },
    { id: 'unused', name: 'Unused', count: 0 },
    { id: 'leftovers', name: 'Leftovers', count: 0 },
    { id: 'suspicious', name: 'Suspicious', count: 0 },
];

const STORES = [
    { id: 'appstore', name: 'App Store', count: 0 },
    { id: 'other', name: 'Other', count: 0 },
];

const VENDORS = [
    { name: 'Apple', count: 3 },
    { name: 'Microsoft', count: 10 },
    { name: 'Adobe', count: 2 },
    { name: 'Google', count: 2 },
    { name: 'MacPaw', count: 5 },
    { name: 'Other', count: 24 },
];

export function Uninstaller() {
    const [apps, setApps] = useState<AppInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeCategory, setActiveCategory] = useState('all');
    const [sortBy, setSortBy] = useState<'name' | 'size'>('size');

    useEffect(() => {
        const loadApps = async () => {
            try {
                // await new Promise(r => setTimeout(r, 1000)); // Mock delay
                const data = await invoke<AppInfo[]>('scan_apps_command');
                setApps(data);
            } catch (e) {
                console.error("Failed to load apps", e);
            } finally {
                setLoading(false);
            }
        };
        loadApps();
    }, []);

    // Filter Logic
    const filteredApps = useMemo(() => {
        let result = apps;

        // Search
        if (search) {
            result = result.filter(app => app.name.toLowerCase().includes(search.toLowerCase()));
        }

        // Category Filter (Mock logic for now, except 'all')
        if (activeCategory === 'unused') {
            // Mock: select random 20%
            result = result.filter((_, i) => i % 5 === 0);
        } else if (activeCategory === 'leftovers') {
            // Mock: none for now
            result = [];
        }

        // Sort
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
            // We need a batch command ideally, but iterating for now if backend only has single
            // NOTE: Assuming backend `clean_items` can handle apps, OR we loop `uninstall_app_command`
            // Let's loop `uninstall_app_command` for safety as it might have specific logic
            for (const path of paths) {
                await invoke('uninstall_app_command', { path });
            }

            setApps(prev => prev.filter(a => !selectedApps.has(a.path)));
            setSelectedApps(new Set());
            playCompletionSound();
        } catch (error) {
            console.error(error);
            alert("Failed to uninstall some apps: " + error);
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
        <div className="h-full w-full bg-transparent text-white flex flex-col font-sans overflow-hidden relative">
            {/* Background Accents */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-[#1E3A8A]/50 backdrop-blur-md shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <button className="text-white/70 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
                        <ArrowLeft size={18} /> Back
                    </button>
                    {/* Breadcrumbs or Title */}
                    <div className="text-white/30 text-sm"> Uninstaller </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                            type="text"
                            placeholder="Search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-400/50 w-56 transition-all focus:w-64"
                        />
                    </div>
                    {/* Assistant Button Mock */}
                    <button className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium border border-white/10 transition-colors flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        Assistant
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden z-10">
                {/* Sidebar */}
                <div className="w-64 bg-[#0F172A]/40 border-r border-white/5 flex flex-col backdrop-blur-sm overflow-y-auto">
                    <div className="p-4 space-y-6">
                        {/* Categories */}
                        <div>
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all mb-1 ${activeCategory === cat.id
                                        ? 'bg-blue-600/20 text-white font-medium shadow-sm'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                                        }`}
                                >
                                    <span>{cat.name}</span>
                                    <span className="text-xs opacity-50">{cat.id === 'all' ? apps.length : cat.count}</span>
                                </button>
                            ))}
                        </div>

                        {/* Stores */}
                        <div>
                            <h3 className="text-xs font-bold text-white/30 uppercase tracking-wider mb-2 px-3">Stores</h3>
                            {STORES.map(store => (
                                <button
                                    key={store.id}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white/90 transition-all mb-1"
                                >
                                    <span>{store.name}</span>
                                    <span className="text-xs opacity-50">{store.count || (store.id === 'other' ? apps.length : 0)}</span>
                                </button>
                            ))}
                        </div>

                        {/* Vendors */}
                        <div>
                            <h3 className="text-xs font-bold text-white/30 uppercase tracking-wider mb-2 px-3">Vendors</h3>
                            {VENDORS.map(vendor => (
                                <button key={vendor.name} className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white/90 transition-all mb-1">
                                    <span>{vendor.name}</span>
                                    <span className="text-xs opacity-50">{vendor.count}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col bg-gradient-to-br from-transparent to-black/20">
                    <div className="p-8 pb-4">
                        <div className="flex items-end justify-between mb-2">
                            <div>
                                <h1 className="text-3xl font-bold text-white mb-2">{CATEGORIES.find(c => c.id === activeCategory)?.name}</h1>
                                <p className="text-white/60 text-sm max-w-xl">
                                    {activeCategory === 'all'
                                        ? "All of the applications installed on your Mac are presented below."
                                        : "Review and remove specific applications."}
                                </p>
                            </div>

                            {/* Sort Dropdown */}
                            <button
                                onClick={() => setSortBy(prev => prev === 'name' ? 'size' : 'name')}
                                className="text-xs text-blue-300 hover:text-white transition-colors flex items-center gap-1"
                            >
                                Sort by {sortBy === 'name' ? 'Name' : 'Size'} ▾
                            </button>
                        </div>
                    </div>

                    {/* List Header */}
                    <div className="px-8 pb-2 flex items-center gap-4 text-xs font-medium text-white/40 border-b border-white/5 mx-6">
                        <div className="w-8 flex justify-center">
                            <button onClick={handleSelectAll} className="hover:text-white transition-colors">
                                {selectedApps.size > 0 && selectedApps.size === filteredApps.length ? 'None' : 'All'}
                            </button>
                        </div>
                        <div className="flex-1">Application Name</div>
                        <div className="w-24 text-right">Size</div>
                        <div className="w-6"></div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto px-6 py-2">
                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <span className="animate-pulse text-white/40">Loading applications...</span>
                            </div>
                        ) : filteredApps.length === 0 ? (
                            <div className="text-center py-20 text-white/30">
                                No applications found in this category.
                            </div>
                        ) : (
                            <div className="space-y-1 pb-24">
                                {filteredApps.map(app => {
                                    const isSelected = selectedApps.has(app.path);
                                    return (
                                        <div
                                            key={app.path}
                                            onClick={() => handleToggleSelect(app.path)}
                                            className={`group flex items-center gap-4 py-3 px-4 rounded-xl cursor-pointer border transition-all ${isSelected
                                                ? 'bg-blue-600/20 border-blue-500/30'
                                                : 'hover:bg-white/5 border-transparent hover:border-white/5'
                                                }`}
                                        >
                                            {/* Checkbox */}
                                            <div className="w-8 flex justify-center shrink-0">
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/20 group-hover:border-white/40'
                                                    }`}>
                                                    {isSelected && <div className="w-2 h-2 bg-white rounded-full shadow-sm" />}
                                                </div>
                                            </div>

                                            {/* Icon */}
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shadow-inner shrink-0 ${isSelected ? 'bg-blue-500/20' : 'bg-white/5 group-hover:bg-white/10'
                                                }`}>
                                                {/* Fallback Icon */}
                                                <Package className={isSelected ? "text-blue-300" : "text-white/40"} size={20} />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-medium text-sm truncate ${isSelected ? 'text-blue-100' : 'text-white/90'}`}>
                                                    {app.name}
                                                </div>
                                                <div className="text-xs text-white/30 truncate flex items-center gap-2">
                                                    {/* Fake vendor for now */}
                                                    <span>{app.bundle_id?.split('.')[1] || 'Unknown Vendor'}</span>
                                                </div>
                                            </div>

                                            {/* Size */}
                                            <div className="w-24 text-right text-sm font-mono text-white/50 group-hover:text-white/80 transition-colors">
                                                {formatBytes(app.size_bytes)}
                                            </div>

                                            {/* Arrow */}
                                            <div className="w-6 flex justify-center text-white/20 group-hover:text-white/60">
                                                <ChevronRight size={16} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Floating Action Button */}
                    <AnimatePresence>
                        {selectedApps.size > 0 && (
                            <motion.div
                                initial={{ y: 100, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 100, opacity: 0 }}
                                className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#1E1E2E] border border-white/10 rounded-full shadow-2xl shadow-black/50 p-2 pr-6 flex items-center gap-4 z-30"
                            >
                                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <Trash2 size={20} className="text-white" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs text-white/40 font-medium uppercase tracking-wider">Ready to Uninstall</span>
                                    <span className="text-sm font-bold text-white">
                                        {selectedApps.size} {selectedApps.size === 1 ? 'App' : 'Apps'} · <span className="text-blue-400">{formatBytes(totalSelectedSize)}</span>
                                    </span>
                                </div>
                                <div className="h-8 w-px bg-white/10 mx-2" />
                                <button
                                    onClick={handleUninstall}
                                    disabled={isDeleting}
                                    className="bg-white text-blue-900 hover:bg-blue-50 px-6 py-2 rounded-full font-bold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
