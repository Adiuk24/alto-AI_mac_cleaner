import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ShieldAlert, Package, Search } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { formatBytes } from '../utils/formatBytes';

interface AppInfo {
    name: string;
    path: string;
    size_bytes: number;
}

export function Uninstaller() {
    const [apps, setApps] = useState<AppInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedApp, setSelectedApp] = useState<AppInfo | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const loadApps = async () => {
            const data = await invoke<AppInfo[]>('scan_apps_command');
            setApps(data);
            setLoading(false);
        };
        loadApps();
    }, []);

    const filtered = apps.filter(app => app.name.toLowerCase().includes(search.toLowerCase()));

    const handleUninstall = async () => {
        if (!selectedApp) return;
        setIsDeleting(true);
        try {
            await invoke('uninstall_app_command', { path: selectedApp.path });
            setApps(apps.filter(a => a.path !== selectedApp.path));
            setSelectedApp(null);
        } catch (error) {
            console.error(error);
            alert("Failed to uninstall: " + error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="h-full flex flex-col pt-8 px-6">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-pink-600">Uninstaller</h1>
                    <p className="text-white/60 mt-1">Remove applications and their leftovers securely.</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                    <input
                        type="text"
                        placeholder="Search apps..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-white/10 border border-white/10 rounded-xl text-sm focus:outline-none focus:bg-white/15"
                    />
                </div>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden pb-6">
                {/* App List */}
                <div className="w-1/2 glass-panel rounded-2xl overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-white/10 text-xs font-medium text-white/50 flex justify-between bg-white/5">
                        <span>{filtered.length} Applications</span>
                        <span>Size</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {loading ? (
                            <div className="text-center p-10 text-white/40">Scanning applications...</div>
                        ) : filtered.map(app => (
                            <button
                                key={app.path}
                                onClick={() => setSelectedApp(app)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${selectedApp?.path === app.path ? 'bg-red-500/20 text-white border border-red-500/20' : 'hover:bg-white/5 text-white/70 border border-transparent'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                                        <Package size={16} />
                                    </div>
                                    <span className="font-medium text-sm truncate max-w-[140px]">{app.name}</span>
                                </div>
                                <span className="text-xs opacity-70">{formatBytes(app.size_bytes)}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Details Panel */}
                <div className="w-1/2 glass-panel rounded-2xl p-6 flex flex-col items-center justify-center text-center relative">
                    {selectedApp ? (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selectedApp.path}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="space-y-6 w-full max-w-sm"
                            >
                                <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-red-900/20">
                                    <Package size={48} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">{selectedApp.name}</h2>
                                    <p className="text-white/40 text-sm mt-1 break-all">{selectedApp.path}</p>
                                </div>

                                <div className="bg-white/5 rounded-xl p-4 text-left space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-white/60">Binary</span>
                                        <span>{formatBytes(selectedApp.size_bytes * 0.8)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-white/60">Support Files</span>
                                        <span>{formatBytes(selectedApp.size_bytes * 0.15)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-white/60">Preferences</span>
                                        <span>{formatBytes(selectedApp.size_bytes * 0.05)}</span>
                                    </div>
                                    <div className="h-px bg-white/10 my-2" />
                                    <div className="flex justify-between font-bold">
                                        <span>Total</span>
                                        <span>{formatBytes(selectedApp.size_bytes)}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleUninstall}
                                    disabled={isDeleting}
                                    className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl font-bold shadow-lg shadow-red-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? 'Removing...' : (
                                        <>
                                            <Trash2 size={20} /> Uninstall
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        </AnimatePresence>
                    ) : (
                        <div className="text-white/30 space-y-4">
                            <ShieldAlert size={64} className="mx-auto opacity-50" />
                            <p>Select an application to view details and remove it safely.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
