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

    // Proactive Monitor Loop (Mock for visual)
    useEffect(() => {
        // ... (existing logic handled by store, keeping component clean)
    }, []);

    return (
        <div className="h-full relative overflow-hidden flex flex-col items-center justify-center">

            {/* Subtle Ambient Glows - simplified to let CSS bg shine */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

            <AnimatePresence mode="wait">
                {scanStatus === 'idle' ? (
                    <motion.div
                        key="idle"
                        className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto -mt-10"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                    >

                        {/* Central Graphic: Abstract 'Mac' Representation */}
                        <motion.div
                            className="mb-10 relative"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.7 }}
                        >
                            <div className="w-80 h-60 rounded-3xl glass-card flex items-center justify-center relative bg-gradient-to-br from-white/10 to-transparent shadow-2xl border border-white/20">
                                {/* Screen Glow */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/20 to-blue-500/20 rounded-3xl" />

                                {/* Wiper / Icon Animation */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 blur-2xl opacity-40 animate-pulse" />
                                    <Zap className="w-24 h-24 text-white/90 relative z-10 drop-shadow-lg" />
                                </div>

                                {/* Abstract 'Wiper' overlay */}
                                <motion.div
                                    className="absolute w-[120%] h-20 bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-45"
                                    animate={{ x: [-200, 200] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                />
                            </div>
                            {/* Stand */}
                            <div className="w-24 h-12 bg-white/10 mx-auto -mt-4 rounded-b-2xl backdrop-blur-md border-x border-b border-white/10" />
                            <div className="w-40 h-3 bg-black/20 mx-auto mt-2 rounded-full blur-md" />
                        </motion.div>

                        {/* Hero Text */}
                        <motion.h1
                            className="text-5xl font-bold text-white mb-3 tracking-tight drop-shadow-lg"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            Welcome to Alto
                        </motion.h1>

                        <motion.p
                            className="text-xl text-white/70 mb-16 font-medium"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            Start with a nice and thorough scan of your Mac.
                        </motion.p>

                        {/* Bottom Anchored Scan Button */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.4, type: "spring" }}
                        >
                            <button
                                onClick={handleScan}
                                className="btn-scan group"
                            >
                                <span className="relative z-10">Scan</span>
                                {/* Pulse Ring */}
                                <div className="absolute inset-0 rounded-full border border-white/40 animate-ping opacity-20" />
                            </button>
                        </motion.div>

                    </motion.div>
                ) : (
                    <motion.div
                        key="scanning"
                        className="relative z-10 flex flex-col items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        {/* Scanning State (Simplified for now) */}
                        <div className="w-64 h-64 relative flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                            <div className="absolute inset-0 rounded-full border-4 border-t-pink-500 animate-spin" />
                            <div className="text-2xl font-bold text-white">Scanning...</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {error && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 p-4 glass-strong text-red-400 rounded-xl flex items-center gap-2 text-sm shadow-xl z-50">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
