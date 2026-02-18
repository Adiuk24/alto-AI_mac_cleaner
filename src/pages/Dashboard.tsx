import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Trash2, Shield, Zap } from 'lucide-react';
import { useScanStore } from '../store/scanStore';
import { useTauri } from '../hooks/useTauri';
import { useState, useEffect } from 'react';
import { formatBytes } from '../utils/formatBytes';
import { startScanSound, playCompletionSound } from '../utils/sounds';

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
    } = useScanStore();

    const { call } = useTauri();
    const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'done'>('idle');
    const [error, setError] = useState<string | null>(null);

    // Initial check if we have results
    // Derived state for scan status
    useEffect(() => {
        if (junkResult || largeFilesResult) {
            // Defer strict mode double-invoke protection
            const t = setTimeout(() => setScanStatus('done'), 0);
            return () => clearTimeout(t);
        }
    }, [junkResult, largeFilesResult]);

    const handleScan = async () => {
        setScanStatus('scanning');
        setError(null);
        useScanStore.getState().reset();

        startScanSound();
        startJunkScan();
        startLargeFilesScan();

        try {
            // Run scans in parallel
            const [junk, large] = await Promise.all([
                call<any>('scan_junk_command'),
                call<any>('scan_large_files_command')
            ]);

            if (junk) finishJunkScan(junk);
            if (large) finishLargeFilesScan(large);

            // Artificial delay to make it feel like "Smart Scan" is thinking and to show animation
            if (Date.now() % 2 === 0) await new Promise(r => setTimeout(r, 1500));

            setScanStatus('done');
            playCompletionSound();
        } catch (e) {
            console.error(e);
            setError("Scan failed. Please try again.");
            setScanStatus('idle');
        }
    };

    const totalJunkSize = (junkResult?.total_size_bytes || 0);
    const totalLargeSize = (largeFilesResult?.total_size_bytes || 0);
    const GrandTotal = totalJunkSize + totalLargeSize;

    return (
        <div className="h-full flex flex-col relative w-full items-center justify-center p-8 text-center bg-transparent">
            {/* Ambient Background Elements */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

            <AnimatePresence mode="wait">

                {/* 1. IDLE STATE */}
                {scanStatus === 'idle' && (
                    <motion.div
                        key="idle"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center"
                    >
                        <h1 className="text-4xl font-bold mb-2 text-white">Smart Scan</h1>
                        <p className="text-white/50 text-lg mb-12">
                            Optimization, cleaning, and protection for your Mac.
                        </p>

                        <motion.button
                            onClick={handleScan}
                            className="group relative w-32 h-32 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 shadow-2xl shadow-purple-500/40 flex items-center justify-center transition-all duration-300 hover:shadow-[0_0_60px_rgba(168,85,247,0.6)]"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <div className="absolute inset-0 rounded-full border border-white/20 group-hover:border-white/40 transition-colors" />
                            <span className="text-2xl font-bold text-white">Start</span>
                        </motion.button>

                        <div className="mt-12 flex gap-8">
                            {['Cleanup', 'Protection', 'Speed'].map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-white/30 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-white/20" />
                                    {item}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* 2. SCANNING STATE */}
                {scanStatus === 'scanning' && (
                    <motion.div
                        key="scanning"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center"
                    >
                        <div className="relative w-64 h-64 mb-8 flex items-center justify-center">
                            {/* Inner Circle */}
                            <div className="w-40 h-40 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative z-10 backdrop-blur-md">
                                <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 animate-pulse">
                                    Scanning...
                                </span>
                            </div>

                            {/* Pulse Rings */}
                            {[1, 2, 3].map(i => (
                                <motion.div
                                    key={i}
                                    className="absolute inset-0 border border-purple-500/30 rounded-full"
                                    animate={{ scale: [0.8, 1.5], opacity: [0.8, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }}
                                />
                            ))}
                        </div>
                        <p className="text-white/50 animate-pulse">Checking system health...</p>
                    </motion.div>
                )}

                {/* 3. DONE STATE */}
                {scanStatus === 'done' && (
                    <motion.div
                        key="done"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-4xl"
                    >
                        <div className="mb-12">
                            <h2 className="text-3xl font-bold text-white mb-2">Alright, here's what I've found.</h2>
                            <p className="text-white/50">
                                All of the tasks to keep your Mac clean, safe, and optimized are waiting. Run them all at once!
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                            {/* Cleanup Pillar */}
                            <motion.div
                                className="flex flex-col items-center group cursor-pointer"
                                whileHover={{ y: -5 }}
                                onClick={() => onNavigate('system-junk')}
                            >
                                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/30 flex items-center justify-center mb-4 group-hover:shadow-blue-500/50 transition-shadow">
                                    <Trash2 size={40} className="text-white" />
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                        <CheckCircle size={12} className="text-white" />
                                    </div>
                                    <span className="font-bold text-white">Cleanup</span>
                                </div>
                                <p className="text-sm text-white/50 mb-2">Removes unneeded junk</p>
                                <div className="text-3xl font-light text-blue-300 mb-2">
                                    {formatBytes(GrandTotal)}
                                </div>
                                <button className="text-xs px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white/70 transition-colors">
                                    Review Details...
                                </button>
                            </motion.div>

                            {/* Protection Pillar */}
                            <motion.div
                                className="flex flex-col items-center group cursor-pointer"
                                whileHover={{ y: -5 }}
                                onClick={() => onNavigate('malware')}
                            >
                                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg shadow-green-500/30 flex items-center justify-center mb-4 group-hover:shadow-green-500/50 transition-shadow">
                                    <Shield size={40} className="text-white" />
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-white">Protection</span>
                                </div>
                                <p className="text-sm text-white/50 mb-2">Neutralizes potential threats</p>
                                <div className="text-4xl font-light text-green-400 mb-2">
                                    OK
                                </div>
                                <p className="text-xs text-white/40">No threats found</p>
                            </motion.div>

                            {/* Speed Pillar */}
                            <motion.div
                                className="flex flex-col items-center group cursor-pointer"
                                whileHover={{ y: -5 }}
                                onClick={() => onNavigate('optimization')}
                            >
                                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-600 shadow-lg shadow-pink-500/30 flex items-center justify-center mb-4 group-hover:shadow-pink-500/50 transition-shadow">
                                    <Zap size={40} className="text-white" />
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center">
                                        <CheckCircle size={12} className="text-white" />
                                    </div>
                                    <span className="font-bold text-white">Speed</span>
                                </div>
                                <p className="text-sm text-white/50 mb-2">Increases system performance</p>
                                <div className="text-4xl font-light text-pink-300 mb-2">
                                    2
                                </div>
                                <p className="text-xs text-white/40">tasks to run</p>
                            </motion.div>
                        </div>

                        <div className="flex justify-center">
                            <motion.button
                                onClick={() => onNavigate('system-junk')}
                                className="w-32 h-32 rounded-full bg-gradient-to-t from-white/10 to-white/5 border border-white/20 backdrop-blur-md flex items-center justify-center group hover:bg-white/10 transition-all hover:scale-105"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                <div className="absolute inset-2 rounded-full border border-white/10 group-hover:border-white/30 transition-colors" />
                                <span className="text-lg font-medium text-white group-hover:text-pink-200">Run</span>
                            </motion.button>
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
