import { motion } from 'framer-motion';
import { HardDrive, Cpu, Zap, ShieldCheck } from 'lucide-react';
import type { SystemStats } from '../../types';
import { formatBytes } from '../../utils/formatBytes';

interface SystemOverviewWidgetProps {
    stats: SystemStats | null;
    junkSize: number;
    onClean: () => void;
    onNavigate: (tab: string) => void;
}

export function SystemOverviewWidget({ stats, junkSize, onClean, onNavigate }: SystemOverviewWidgetProps) {
    if (!stats) return null;

    const memPercent = (stats.memory_used / stats.memory_total) * 100;
    const isHighJunk = junkSize > 1024 * 1024 * 1024; // 1GB

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm bg-[#1E1E2E]/80 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl my-4 text-white"
        >
            {/* Header / Protection Status */}
            <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 p-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="text-emerald-400" size={18} />
                    <span className="font-semibold text-sm text-emerald-100">System Protected</span>
                </div>
                <span className="text-[10px] text-emerald-200/60 uppercase tracking-widest font-bold">Real-time</span>
            </div>

            {/* Main Stats Grid */}
            <div className="p-4 grid grid-cols-2 gap-3">
                {/* Disk / Junk */}
                <div className="col-span-2 bg-white/5 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isHighJunk ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            <HardDrive size={20} />
                        </div>
                        <div>
                            <div className="text-xs text-white/50">System Junk</div>
                            <div className="font-mono text-sm">{formatBytes(junkSize)}</div>
                        </div>
                    </div>
                    {isHighJunk && (
                        <button
                            onClick={onClean}
                            className="bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Clean
                        </button>
                    )}
                </div>

                {/* CPU */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-white/50">
                        <Cpu size={16} /> <span className="text-xs">CPU Load</span>
                    </div>
                    <div className="text-xl font-light">{stats.cpu_load.toFixed(1)}%</div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-indigo-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.cpu_load}%` }}
                        />
                    </div>
                </div>

                {/* RAM */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-white/50">
                        <Zap size={16} /> <span className="text-xs">Memory</span>
                    </div>
                    <div className="text-xl font-light">{memPercent.toFixed(0)}%</div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-purple-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${memPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-white/5 p-3 flex gap-2">
                <button
                    onClick={() => onNavigate('dashboard')}
                    className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-medium text-white/70 transition-colors"
                >
                    Open Dashboard
                </button>
                <button
                    onClick={() => onNavigate('system-junk')}
                    className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-medium text-white/70 transition-colors"
                >
                    Detailed Scan
                </button>
            </div>
        </motion.div>
    );
}
