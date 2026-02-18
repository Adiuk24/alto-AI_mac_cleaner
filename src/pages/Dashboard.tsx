import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Trash2, Shield, Zap, Sparkles } from 'lucide-react';
import { useScanStore } from '../store/scanStore';
import { useTauri } from '../hooks/useTauri';
import { useState, useEffect } from 'react';
import { formatBytes } from '../utils/formatBytes';
import { AiInsight } from '../components/AiInsight';
import { Button } from '../components/Button';
import { playCompletionSound } from '../utils/sounds';

interface DashboardProps {
    onNavigate: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
    const {
        junkResult,
        largeFilesResult,
        startJunkScan,
        finishJunkScan,
        startLargeFilesScan,
        finishLargeFilesScan,
        aiInsight,
        isGeneratingInsight,
        generateInsight
    } = useScanStore();

    const { call } = useTauri();
    const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'done'>('idle');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (junkResult || largeFilesResult) {
            setScanStatus('done');
            if (!aiInsight && !isGeneratingInsight) {
                generateInsight();
            }
        }
    }, [junkResult, largeFilesResult, aiInsight, isGeneratingInsight, generateInsight]);

    const handleScan = async () => {
        setScanStatus('scanning');
        setError(null);
        useScanStore.getState().reset();
        startJunkScan();
        startLargeFilesScan();

        try {
            const [junk, large] = await Promise.all([
                call<any>('scan_junk_command'),
                call<any>('scan_large_files_command')
            ]);
            if (junk) finishJunkScan(junk);
            if (large) finishLargeFilesScan(large);
            setScanStatus('done');
            generateInsight();
            playCompletionSound();
        } catch (e) {
            setError("Scan failed. Please try again.");
            setScanStatus('idle');
        }
    };

    const totalJunkSize = (junkResult?.total_size_bytes || 0);
    const totalLargeSize = (largeFilesResult?.total_size_bytes || 0);
    const GrandTotal = totalJunkSize + totalLargeSize;
    const junkCount = junkResult?.items?.length || 0;
    const largeCount = largeFilesResult?.items?.length || 0;
    const totalItems = junkCount + largeCount;

    return (
        <div className="h-full flex flex-col relative">
            <AnimatePresence mode="wait">
                {scanStatus === 'idle' && (
                    <motion.div
                        key="idle"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex-1 flex flex-col items-center justify-center text-center px-8"
                    >
                        {/* Welcome Hero */}
                        <motion.div
                            className="mb-8"
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                        >
                            <div className="w-40 h-40 mx-auto mb-6 relative">
                                {/* Monitor shape */}
                                <div className="w-full h-[120px] rounded-2xl bg-gradient-to-br from-purple-500/80 to-pink-500/80 border border-white/20 shadow-2xl shadow-purple-500/30 flex items-center justify-center overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
                                    <Sparkles className="w-12 h-12 text-white/90" strokeWidth={1.5} />
                                </div>
                                {/* Stand */}
                                <div className="w-16 h-4 mx-auto bg-gradient-to-b from-purple-400/40 to-transparent rounded-b-lg" />
                                <div className="w-24 h-2 mx-auto bg-white/10 rounded-full" />
                                {/* Sparkle dots */}
                                <motion.div
                                    className="absolute -top-3 -right-3 w-3 h-3 bg-cyan-400 rounded-full"
                                    animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                                <motion.div
                                    className="absolute -top-1 -left-4 w-2 h-2 bg-pink-400 rounded-full"
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                                />
                                <motion.div
                                    className="absolute top-8 -right-6 w-2 h-2 bg-yellow-400 rounded-full"
                                    animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                                    transition={{ duration: 1.8, repeat: Infinity, delay: 1 }}
                                />
                            </div>
                        </motion.div>

                        <motion.h1
                            className="text-4xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/60"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            Welcome to Alto
                        </motion.h1>
                        <motion.p
                            className="text-white/50 text-lg mb-12 max-w-md"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            Start with a nice and thorough scan of your System.
                        </motion.p>

                        {/* Centered pill scan button */}
                        <motion.button
                            onClick={handleScan}
                            className="group relative w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 shadow-xl shadow-purple-500/30 flex items-center justify-center hover:shadow-[0_0_40px_rgba(168,85,247,0.4)] transition-all duration-300"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            {/* Glow ring */}
                            <div className="absolute inset-[-6px] rounded-full border border-purple-400/30 group-hover:border-purple-400/50 transition-colors" />
                            <span className="text-white font-semibold text-lg">Scan</span>
                        </motion.button>
                    </motion.div>
                )}

                {scanStatus === 'scanning' && (
                    <motion.div
                        key="scanning"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex items-center justify-center"
                    >
                        <div className="relative w-80 h-80 flex items-center justify-center">
                            {[1, 2, 3].map((i) => (
                                <motion.div
                                    key={i}
                                    className="absolute inset-0 border border-purple-500/30 rounded-full"
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                                    transition={{ duration: 2, delay: i * 0.4, repeat: Infinity }}
                                />
                            ))}
                            <div className="w-48 h-48 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex flex-col items-center justify-center z-10 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 to-transparent animate-spin-slow" />
                                <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400">
                                    Scanning...
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {scanStatus === 'done' && (
                    <motion.div
                        key="done"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex-1 flex flex-col p-8"
                    >
                        <div className="text-center mb-6">
                            <h2 className="text-5xl font-bold text-white mb-2">{formatBytes(GrandTotal)}</h2>
                            <p className="text-white/50 text-lg">
                                {largeCount > 0
                                    ? "Total clutter found on your Mac."
                                    : "Total junk found can be safely removed."}
                            </p>
                        </div>

                        <AiInsight insight={aiInsight} loading={isGeneratingInsight} />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                            {/* Cleanup Card */}
                            <div
                                onClick={() => onNavigate('system-junk')}
                                className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col hover:border-pink-500/30 hover:bg-pink-500/5 transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 rounded-xl bg-pink-500/20 text-pink-400 group-hover:text-pink-300 transition-colors">
                                        <Trash2 size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">Cleanup</h3>
                                        <p className="text-xs text-white/50">System Junk & Large Files</p>
                                    </div>
                                </div>
                                <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-end">
                                    <div>
                                        <div className="text-2xl font-bold text-white">{formatBytes(GrandTotal)}</div>
                                        <div className="text-xs text-white/40">{totalItems} items</div>
                                    </div>
                                    <span className="text-sm text-pink-300 group-hover:text-pink-200 font-medium">Review →</span>
                                </div>
                            </div>

                            {/* Protection Card */}
                            <div
                                onClick={() => onNavigate('malware')}
                                className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col hover:border-blue-500/30 hover:bg-blue-500/5 transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 rounded-xl bg-blue-500/20 text-blue-400 group-hover:text-blue-300 transition-colors">
                                        <Shield size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">Protection</h3>
                                        <p className="text-xs text-white/50">Malware & Privacy</p>
                                    </div>
                                </div>
                                <div className="mt-auto">
                                    <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                                        <CheckCircle size={16} /> Looks Good
                                    </div>
                                </div>
                            </div>

                            {/* Speed Card */}
                            <div
                                onClick={() => onNavigate('optimization')}
                                className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col hover:border-yellow-500/30 hover:bg-yellow-500/5 transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 rounded-xl bg-yellow-500/20 text-yellow-400 group-hover:text-yellow-300 transition-colors">
                                        <Zap size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">Speed</h3>
                                        <p className="text-xs text-white/50">Optimization</p>
                                    </div>
                                </div>
                                <div className="mt-auto">
                                    <span className="text-sm text-yellow-300 group-hover:text-yellow-200 font-medium">Optimize →</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 text-center">
                            <Button
                                variant="ghost"
                                onClick={handleScan}
                                className="text-white/40 hover:text-white"
                            >
                                Run Smart Scan again
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {error && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 p-4 glass-strong text-red-400 rounded-xl flex items-center gap-2 text-sm shadow-xl">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
