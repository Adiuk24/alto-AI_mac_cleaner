import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, Cpu, Battery, Activity, Shield, Wifi, Smartphone, Bluetooth, Mouse, Keyboard, Headphones, Speaker } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { formatBytes } from '../utils/formatBytes';

import type { SystemStats } from '../types';

export function MenuApp() {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [contextStore, setContextStore] = useState<any>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await invoke<SystemStats>('get_system_stats_command');
                setStats(data);
            } catch (e) {
                console.error(e);
            }
        };

        const fetchContext = async () => {
            try {
                const ctx = await invoke('get_mcp_context');
                setContextStore(ctx);
            } catch (e) {
                console.error(e);
            }
        };

        fetchStats();
        fetchContext();
        const interval = setInterval(() => {
            fetchStats();
            fetchContext();
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    // Helper to format network speed
    const formatSpeed = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B/s`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
    };

    const getDeviceIcon = (type: string) => {
        switch (type) {
            case 'mouse': return <Mouse size={14} />;
            case 'keyboard': return <Keyboard size={14} />;
            case 'headphones': return <Headphones size={14} />;
            case 'speaker': return <Speaker size={14} />;
            case 'phone': return <Smartphone size={14} />;
            default: return <Bluetooth size={14} />;
        }
    };

    if (!stats) {
        return (
            <div className="h-screen w-full bg-transparent p-2 overflow-hidden flex flex-col font-sans select-none">
                <div className="flex-1 bg-[#1e1135] rounded-2xl p-4 flex items-center justify-center border border-white/10 shadow-2xl">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        <span className="text-xs text-white/40">Loading System Stats...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-transparent p-2 overflow-hidden flex flex-col font-sans select-none">
            <div className="flex-1 bg-card/95 rounded-2xl overflow-y-auto p-4 shadow-2xl border border-white/5 flex flex-col relative no-scrollbar backdrop-blur-2xl">
                {/* Recommendations */}
                <h2 className="text-sm font-semibold mb-3 text-white/90">Recommendations</h2>
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col justify-between h-36 relative group hover:bg-white/10 transition-colors">
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
                        <HardDrive className="text-white/60 mb-2" size={20} />
                        <div>
                            <div className="text-xs text-white/50 mb-1">Clean available</div>
                            <div className="text-sm font-medium mb-3 leading-tight">
                                {contextStore?.deletion_history?.length > 0
                                    ? `Total cleaned: ${formatBytes(contextStore.deletion_history.reduce((acc: number, r: any) => acc + r.total_bytes_freed, 0))}`
                                    : "Run a scan to find purgeable space."
                                }
                            </div>
                            <button className="w-full py-2 bg-yellow-400 text-black text-xs font-bold rounded-xl hover:bg-yellow-300 transition-all shadow-lg shadow-yellow-500/20 active:scale-95">
                                Free Up Space
                            </button>
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col justify-between h-36 relative group hover:bg-white/10 transition-colors">
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
                        <Activity className="text-white/60 mb-2" size={20} />
                        <div>
                            <div className="text-xs text-white/50 mb-1">Optimization</div>
                            <div className="text-sm font-medium mb-3 leading-tight">Uninstall the apps you don't use.</div>
                            <button className="w-full py-2 bg-white/10 text-white text-xs font-bold rounded-xl hover:bg-white/20 transition-all border border-white/10 active:scale-95">
                                Go to Applications
                            </button>
                        </div>
                    </div>
                </div>

                {/* System Overview */}
                <h2 className="text-xs font-semibold mb-3 text-white/90 uppercase tracking-wide ml-1">Mac Overview</h2>

                {/* Protection Widget */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 mb-3 relative group hover:bg-white/10 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-[#23d160] rounded-md shadow-[0_0_10px_rgba(35,209,96,0.3)]">
                                <Shield size={14} className="text-black fill-black" />
                            </div>
                            <span className="text-sm font-semibold">Protection by <span className="font-bold">moonlock</span></span>
                        </div>
                        <span className="text-xs text-white/90 flex items-center gap-1 font-medium">
                            ✓ Protected
                        </span>
                    </div>

                    <div className="text-sm font-medium mb-1">Real-time malware monitor ON</div>
                    <div className="text-xs text-white/50 mb-4 truncate">
                        {contextStore?.system_events?.length > 0
                            ? `Last event: ${contextStore.system_events[contextStore.system_events.length - 1].description}`
                            : "Monitoring system for suspicious activity..."
                        }
                    </div>

                    <div className="flex justify-between items-end">
                        <div className="text-xs text-white/40">Database updates checked 7 hours ago</div>
                        <button className="text-xs font-bold hover:text-white/80 transition-colors">Check Now</button>
                    </div>
                </div>

                {/* Grid Stats */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                    {/* Storage */}
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 group relative hover:bg-white/10 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <HardDrive size={18} className="text-white/70" />
                                <span className="text-sm font-medium">Macintosh HD</span>
                            </div>
                        </div>
                        <div className="text-xs text-[#fbd349] mb-1 font-medium">
                            Available: {stats ? formatBytes(stats.disk_total - stats.disk_used) : '...'}
                        </div>
                        {/* Hover Button Overlay */}
                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs font-bold cursor-pointer hover:underline">Free Up</span>
                        </div>
                        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mt-2 group-hover:opacity-0 transition-opacity">
                            <div
                                className="bg-white/80 h-full transition-all duration-500"
                                style={{ width: stats ? `${(stats.disk_used / stats.disk_total) * 100}%` : '50%' }}
                            />
                        </div>
                    </div>

                    {/* RAM */}
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 group relative hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity size={18} className="text-white/70" />
                            <span className="text-sm font-medium">Memory</span>
                        </div>
                        <div className="text-xs text-white/50 mb-1">
                            Available: {stats ? formatBytes(stats.memory_total - stats.memory_used) : '...'}
                        </div>
                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs font-bold cursor-pointer hover:underline">Free Up</span>
                        </div>
                        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mt-2 group-hover:opacity-0 transition-opacity">
                            <motion.div
                                className="bg-pink-500 h-full"
                                initial={{ width: 0 }}
                                animate={{ width: stats ? `${(stats.memory_used / stats.memory_total) * 100}%` : '50%' }}
                            />
                        </div>
                    </div>

                    {/* Battery */}
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Battery size={18} className="text-white/70" />
                                <span className="text-sm font-medium">Battery</span>
                            </div>
                            <div className="text-sm font-bold text-white/90">93%</div>
                        </div>
                        <div className="text-xs text-white/40">8h 56m remaining</div>
                    </div>

                    {/* CPU */}
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Cpu size={18} className="text-white/70" />
                                <span className="text-sm font-medium">CPU</span>
                            </div>
                            <div className="text-sm font-bold text-white/90">
                                Load: {stats ? stats.cpu_load.toFixed(0) : '0'}%
                            </div>
                        </div>
                        <div className="text-xs text-white/40">Temperature: 45°C</div>
                    </div>
                </div>

                {/* Network */}
                <div className="bg-[#2a1d45] rounded-xl p-4 border border-white/5 mb-3">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Wifi size={20} className="text-white/70" />
                            <span className="text-sm font-medium">Wi-Fi</span>
                        </div>
                    </div>

                    <div className="space-y-3 pl-1">
                        <div className="flex items-center gap-3 text-xs">
                            <span className="text-white/90 font-bold min-w-[12px]">↑</span>
                            <span className="text-white/60">Using {stats ? formatSpeed(stats.network_up) : '0 B/s'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                            <span className="text-white/90 font-bold min-w-[12px]">↓</span>
                            <span className="text-white/60">Using {stats ? formatSpeed(stats.network_down) : '0 B/s'}</span>
                        </div>
                    </div>

                    <div className="flex justify-end mt-2">
                        <button className="text-xs font-bold text-white/90 hover:text-white transition-colors">Test Speed</button>
                    </div>
                </div>

                {/* Connected Devices */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 mb-3 hover:bg-white/10 transition-colors">
                    <div className="text-sm font-semibold mb-3">Connected Devices</div>
                    <div className="space-y-3">
                        {/* My iPhone */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Smartphone size={16} className="text-white/60" />
                                <span className="text-sm">Adis Iphone</span>
                            </div>
                            <span className="text-sm font-bold">83%</span>
                        </div>
                        {/* Loop through real connected devices */}
                        {stats?.connected_devices.map((device, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-white/60">{getDeviceIcon(device.device_type)}</span>
                                    <span className="text-sm truncate max-w-[150px]">{device.name}</span>
                                </div>
                                <span className="text-sm font-bold">
                                    {device.battery_level !== null ? `${device.battery_level}%` : ''}
                                </span>
                            </div>
                        ))}

                        {/* Mock data to match screenshot if empty (for visual parity during dev) */}
                        {!stats?.connected_devices.length && (
                            <>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Mouse size={16} className="text-white/60" />
                                        <span className="text-sm">Arif's Magic Mouse</span>
                                    </div>
                                    <span className="text-sm font-bold">99%</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Keyboard size={16} className="text-white/60" />
                                        <span className="text-sm">Arif's Magic Key...</span>
                                    </div>
                                    <span className="text-sm font-bold">98%</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                        <div className="w-5 h-4 bg-gradient-to-br from-pink-500 to-purple-600 rounded-sm shadow-md"></div>
                    </div>
                    <button className="text-xs font-medium hover:text-white transition-colors">Show CleanMyMac</button>
                    <div className="w-5 h-5 flex items-center justify-center cursor-pointer hover:bg-white/10 rounded-full transition-colors">
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-dashed animate-spin-slow" />
                    </div>
                </div>
            </div>
        </div>
    );
}
