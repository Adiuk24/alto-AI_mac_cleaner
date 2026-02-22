import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Zap } from 'lucide-react';
import { useScanStore } from '../store/scanStore';
import { useTauri } from '../hooks/useTauri';
import { useState, useEffect } from 'react';
import { startScanSound, playCompletionSound } from '../utils/sounds';
import { SmartScanResults } from '../components/dashboard/SmartScanResults';

interface DashboardProps {
    onNavigate: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
    const {
        junkResult,
        largeFilesResult,
        malwareResult,
        startJunkScan,
        finishJunkScan,
        startLargeFilesScan,
        finishLargeFilesScan,
        setMalwareResult,
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
            const result = await call<any>('smart_scan_command');
            if (result?.junk) finishJunkScan(result.junk);
            if (result?.large_files) finishLargeFilesScan(result.large_files);
            if (result?.malware != null) setMalwareResult(result.malware);
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
                {scanStatus === 'idle' && (
                    <motion.div
                        key="idle"
                        className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto -mt-10"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                    >

                        {/* Central Graphic: Abstract 'Mac' Representation */}
                        <motion.div
                            className="mb-12 relative"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        >
                            <div className="w-80 h-56 rounded-3xl glass-frost flex items-center justify-center relative shadow-[0_0_80px_rgba(139,92,246,0.15)] overflow-hidden">
                                {/* Dynamic Gradient Glow — opacity only so it never overflows */}
                                <motion.div
                                    className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-purple-500/5 to-indigo-500/10"
                                    animate={{
                                        opacity: [0.5, 0.8, 0.5]
                                    }}
                                    transition={{ duration: 10, repeat: Infinity }}
                                />

                                {/* Icon Display */}
                                <div className="relative z-10">
                                    <motion.div
                                        animate={{
                                            rotate: [0, 5, -5, 0],
                                            y: [0, -5, 5, 0]
                                        }}
                                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                    >
                                        <Zap className="w-24 h-24 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]" />
                                    </motion.div>
                                </div>

                                {/* Scan Line Animation */}
                                <motion.div
                                    className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/20 to-transparent h-1"
                                    animate={{ top: ["-10%", "110%"] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                />
                            </div>

                            {/* Stand / Platform */}
                            <div className="w-28 h-2 bg-white/5 mx-auto mt-4 rounded-full blur-sm" />
                        </motion.div>

                        {/* Hero Text */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="space-y-4"
                        >
                            <h1 className="text-6xl font-extrabold text-white tracking-tight shimmer-text">
                                Welcome to Alto
                            </h1>
                            <p className="text-xl text-white/50 font-medium max-w-lg mx-auto leading-relaxed">
                                Your Mac, perfectly optimized. Start with a deep system scan to discover hidden junk and security threats.
                            </p>
                        </motion.div>

                        {/* Large Action Area */}
                        <motion.div
                            initial={{ y: 30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="mt-16"
                        >
                            <button
                                onClick={handleScan}
                                className="btn-scan group relative flex items-center justify-center"
                            >
                                <span className="relative z-10">Scan</span>
                                <div className="absolute inset-x-0 -bottom-12 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <p className="text-xs font-mono text-primary uppercase tracking-[0.2em]">Launch Smart Scan</p>
                                </div>
                            </button>
                        </motion.div>

                    </motion.div>
                )}

                {scanStatus === 'scanning' && (
                    <motion.div
                        key="scanning"
                        className="relative z-10 flex flex-col items-center justify-center -mt-20"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="w-96 h-96 relative flex items-center justify-center">
                            {/* Triple Pulse Radial Glows */}
                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
                            <div className="absolute inset-20 bg-indigo-500/10 rounded-full blur-[80px] animate-pulse delay-700" />

                            {/* Circular progress with glass ring */}
                            <div className="absolute inset-0 rounded-full border border-white/5 backdrop-blur-3xl shadow-2xl" />

                            <svg className="w-full h-full transform -rotate-90 relative z-10">
                                <circle
                                    cx="192"
                                    cy="192"
                                    r="180"
                                    fill="transparent"
                                    stroke="rgba(255,255,255,0.02)"
                                    strokeWidth="12"
                                />
                                <motion.circle
                                    cx="192"
                                    cy="192"
                                    r="180"
                                    fill="transparent"
                                    stroke="url(#progress-gradient)"
                                    strokeWidth="12"
                                    strokeLinecap="round"
                                    strokeDasharray="1131"
                                    initial={{ strokeDashoffset: 1131 }}
                                    animate={{ strokeDashoffset: 0 }}
                                    transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
                                />
                                <defs>
                                    <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#f472b6" />
                                        <stop offset="50%" stopColor="#db2777" />
                                        <stop offset="100%" stopColor="#8b5cf6" />
                                    </linearGradient>
                                </defs>
                            </svg>

                            <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                                <motion.div
                                    animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="flex flex-col items-center"
                                >
                                    <span className="text-5xl font-black text-white tracking-widest uppercase">Scanning</span>
                                    <p className="text-white/40 font-mono mt-4 tracking-[0.3em]">Analyzing Architecture</p>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {scanStatus === 'done' && (
                    <motion.div
                        key="done-results"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full"
                    >
                        <SmartScanResults
                            junkSize={GrandTotal}
                            speedTasks={3}
                            malwareThreats={malwareResult?.threats_found?.length ?? 0}
                            onReviewCleanup={() => onNavigate('system-junk')}
                            onRun={async () => {
                                startScanSound();
                                const allPaths = Array.from(useScanStore.getState().selectedJunkItems);
                                if (allPaths.length > 0) {
                                    try {
                                        await call('confirm_delete', { paths: allPaths });
                                        useScanStore.getState().reset();
                                        setScanStatus('idle');
                                        playCompletionSound();
                                    } catch (e: unknown) {
                                        setError(e instanceof Error ? e.message : 'Clean failed. Please try again.');
                                    }
                                }
                            }}
                        />
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
