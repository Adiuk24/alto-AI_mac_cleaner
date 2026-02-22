import { motion } from 'framer-motion';
import { HardDrive, ShieldCheck, Gauge, ChevronRight } from 'lucide-react';
import { formatBytes } from '../../utils/formatBytes';

interface SmartScanResultsProps {
    junkSize: number;
    speedTasks: number;
    malwareThreats?: number;
    onRun: () => void;
    onReviewCleanup: () => void;
}

export function SmartScanResults({
    junkSize,
    speedTasks,
    malwareThreats = 0,
    onRun,
    onReviewCleanup
}: SmartScanResultsProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-5xl px-8 flex flex-col items-center"
        >
            <h2 className="text-4xl font-semibold text-white mb-2">Alright, here's what I've found.</h2>
            <p className="text-white/50 mb-16">All of the tasks to keep your Mac clean, safe, and optimized are waiting. Run them all at once!</p>

            <div className="grid grid-cols-3 gap-12 w-full mb-20">
                {/* Cleanup Column */}
                <div className="flex flex-col items-center text-center group">
                    <div className="w-32 h-32 mb-6 relative">
                        <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full group-hover:bg-blue-500/30 transition-colors" />
                        <div className="relative w-full h-full bg-linear-to-br from-blue-400 to-blue-600 rounded-2xl shadow-xl flex items-center justify-center border border-white/20">
                            <HardDrive size={64} className="text-white drop-shadow-lg" />
                        </div>
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-2 border-[#1a1a2e] flex items-center justify-center"
                        >
                            <div className="w-4 h-4 text-white">✓</div>
                        </motion.div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">Cleanup</h3>
                    <p className="text-sm text-white/50 mb-4">Removes unneeded junk</p>
                    <div className="text-4xl font-light text-blue-300 mb-4">
                        {formatBytes(junkSize)}
                    </div>
                    <button
                        onClick={onReviewCleanup}
                        className="text-xs font-semibold text-blue-400/80 hover:text-blue-300 transition-colors flex items-center gap-1 group"
                    >
                        Review Details...
                    </button>
                </div>

                {/* Protection Column */}
                <div className="flex flex-col items-center text-center group">
                    <div className="w-32 h-32 mb-6 relative">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full group-hover:bg-emerald-500/30 transition-colors" />
                        <div className="relative w-full h-full bg-linear-to-br from-emerald-400 to-teal-600 rounded-full shadow-xl flex items-center justify-center border border-white/20">
                            <ShieldCheck size={64} className="text-white drop-shadow-lg" />
                        </div>
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.1 }}
                            className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-2 border-[#1a1a2e] flex items-center justify-center"
                        >
                            <div className="w-4 h-4 text-white">✓</div>
                        </motion.div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">Protection</h3>
                    <p className="text-sm text-white/50 mb-4">Neutralizes potential threats</p>
                    <div className="text-4xl font-light text-emerald-300 mb-4 uppercase tracking-wider">
                        {malwareThreats > 0 ? malwareThreats : 'OK'}
                    </div>
                    <p className="text-xs text-white/40">{malwareThreats > 0 ? 'threat(s) found' : 'No threats found'}</p>
                </div>

                {/* Speed Column */}
                <div className="flex flex-col items-center text-center group">
                    <div className="w-32 h-32 mb-6 relative">
                        <div className="absolute inset-0 bg-pink-500/20 blur-2xl rounded-full group-hover:bg-pink-500/30 transition-colors" />
                        <div className="relative w-full h-full bg-linear-to-br from-pink-400 to-purple-600 rounded-full shadow-xl flex items-center justify-center border border-white/20">
                            <Gauge size={64} className="text-white drop-shadow-lg" />
                        </div>
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-2 border-[#1a1a2e] flex items-center justify-center"
                        >
                            <div className="w-4 h-4 text-white">✓</div>
                        </motion.div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">Speed</h3>
                    <p className="text-sm text-white/50 mb-4">Increases system performance</p>
                    <div className="text-4xl font-light text-pink-300 mb-4">
                        {speedTasks}
                    </div>
                    <p className="text-xs text-white/40">tasks to run</p>
                </div>
            </div>

            {/* Run Button */}
            <motion.button
                onClick={onRun}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative group"
            >
                <div className="absolute inset-0 bg-blue-500/40 blur-xl rounded-full group-hover:bg-blue-500/60 transition-colors animate-pulse" />
                <div className="relative px-12 py-4 bg-linear-to-r from-blue-500 to-indigo-600 rounded-full border border-white/20 shadow-2xl flex items-center gap-3">
                    <span className="text-xl font-bold text-white tracking-wide">Run</span>
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                        <ChevronRight size={16} className="text-white" />
                    </div>
                </div>
            </motion.button>
        </motion.div>
    );
}
