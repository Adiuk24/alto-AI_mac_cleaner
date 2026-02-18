import { useState, useEffect } from 'react';
import { RefreshCw, Search, ArrowLeft } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';

interface OutdatedApp {
    name: string;
    current_version: string;
    latest_version: string;
}

export function Updater() {
    const [apps, setApps] = useState<OutdatedApp[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAppIndex, setSelectedAppIndex] = useState<number>(0);

    useEffect(() => {
        const load = async () => {
            try {
                // Mock data for visual dev if scan returns empty (remove in prod)
                // const mock: OutdatedApp[] = [
                //     { name: 'WhatsApp Messenger', current_version: '26.5.77', latest_version: '26.6.73' },
                //     { name: 'Pages', current_version: '14.5', latest_version: '14.6' },
                //     { name: 'Numbers', current_version: '14.5', latest_version: '15.0' },
                //     { name: 'Keynote', current_version: '14.5', latest_version: '14.8' },
                // ];
                // setApps(mock);
                // setLoading(false);

                const data = await invoke<OutdatedApp[]>('scan_outdated_apps_command');
                setApps(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const selectedApp = apps[selectedAppIndex];

    return (
        <div className="h-full w-full bg-transparent text-white flex flex-col font-sans overflow-hidden">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#0F2E29]/50 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-4">
                    <button className="text-teal-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
                        <ArrowLeft size={18} /> Back
                    </button>
                    <div className="text-white/30 text-sm"> Intro </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                            type="text"
                            placeholder="Search"
                            className="bg-black/20 border border-white/5 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-teal-500/50 w-48 transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: App List */}
                <div className="w-80 border-r border-white/5 flex flex-col bg-[#0F2E29]/30">
                    <div className="p-4 flex justify-between items-center text-xs font-medium text-white/40 uppercase tracking-wide">
                        <span>Select All</span>
                        <span>Sort by Last Opened ▾</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {loading && (
                            <div className="flex items-center justify-center h-20 gap-2 text-white/40">
                                <RefreshCw className="animate-spin" size={16} /> Scanning...
                            </div>
                        )}
                        {!loading && apps.length === 0 && (
                            <div className="p-8 text-center text-white/40 text-sm">
                                All apps are up to date.
                            </div>
                        )}
                        {apps.map((app, i) => (
                            <div
                                key={i}
                                onClick={() => setSelectedAppIndex(i)}
                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${i === selectedAppIndex
                                    ? 'bg-teal-500/10 border border-teal-500/20'
                                    : 'hover:bg-white/5 border border-transparent'
                                    }`}
                            >
                                {/* Circle Checkbox */}
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${i === selectedAppIndex ? 'border-teal-400' : 'border-white/20'
                                    }`}>
                                    {i === selectedAppIndex && <div className="w-2.5 h-2.5 rounded-full bg-teal-400" />}
                                </div>

                                {/* App Icon Placeholder */}
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shadow-lg ${i === selectedAppIndex ? 'bg-gradient-to-br from-teal-400 to-emerald-600' : 'bg-white/10'
                                    }`}>
                                    {app.name.charAt(0)}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm truncate">{app.name}</div>
                                    <div className="text-xs text-white/40 truncate">Version {app.latest_version}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel: Details */}
                <div className="flex-1 bg-gradient-to-br from-[#113C36] to-[transparent] p-10 flex flex-col relative">
                    {selectedApp ? (
                        <motion.div
                            key={selectedApp.name}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-8"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2 text-sm text-teal-400 font-medium mb-1">
                                        Updater
                                    </div>
                                    <h1 className="text-4xl font-bold mb-4">{selectedApp.name}</h1>
                                    <div className="flex items-center gap-4 text-sm text-white/50 font-mono">
                                        <span>Version {selectedApp.current_version}</span>
                                        <span className="text-white/20">➜</span>
                                        <span className="text-white">{selectedApp.latest_version}</span>
                                        <span className="text-white/20">|</span>
                                        <span>Today</span>
                                        <span className="ml-auto block sm:hidden">145.5 MB</span>
                                    </div>
                                </div>
                                <span className="hidden sm:block text-white/30 font-mono text-sm">145.5 MB</span>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold mb-2">What's New:</h3>
                                <ul className="space-y-2 text-white/70 text-sm leading-relaxed">
                                    <li>• We update the app regularly to fix bugs, optimize performance and improve the experience.</li>
                                    <li>• Thanks for using {selectedApp.name}!</li>
                                </ul>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-white/20">
                            Select an app to view details
                        </div>
                    )}

                    {/* Floating Update Button */}
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-24 h-24 rounded-full bg-gradient-to-t from-white/10 to-white/5 backdrop-blur-md border border-white/10 shadow-2xl flex items-center justify-center flex-col gap-1 group"
                        >
                            <span className="text-sm font-bold text-white/80 group-hover:text-teal-200">Update</span>
                        </motion.button>
                    </div>
                </div>
            </div>
        </div>
    );
}
