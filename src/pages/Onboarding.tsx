import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle, Smartphone, ArrowRight, Download } from 'lucide-react';
import { aiService } from '../services/aiService';

interface OnboardingProps {
    onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
    const [step, setStep] = useState<'welcome' | 'downloading' | 'complete'>('welcome');
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');

    useEffect(() => {
        if (step === 'downloading') {
            const startSetup = async () => {
                aiService.setLoadProgressCallback((text) => {
                    setProgressText(text);
                    // Extract percentage if available in text (e.g. "Loading... 45%")
                    const match = text.match(/(\d+)%/);
                    if (match) {
                        setProgress(parseInt(match[1]));
                    } else if (text.includes("Finish")) {
                        setProgress(100);
                    }
                });

                try {
                    // Force initialization of the engine
                    await aiService.chat([{ role: 'user', content: 'ping' }]);
                    setStep('complete');
                } catch (error) {
                    console.error("Setup failed", error);
                    setProgressText("Error: " + (error as any).message);
                }
            };
            startSetup();
        }
    }, [step]);

    return (
        <div className="h-screen w-full bg-black text-white flex items-center justify-center overflow-hidden relative">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
            <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-purple-900/40 blur-[120px]" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-900/30 blur-[120px]" />

            <div className="z-10 w-full max-w-md p-8 relative">
                <AnimatePresence mode="wait">
                    {step === 'welcome' && (
                        <motion.div
                            key="welcome"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="text-center space-y-8"
                        >
                            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-purple-500/30">
                                <Sparkles size={40} className="text-white" />
                            </div>

                            <div className="space-y-4">
                                <h1 className="text-3xl font-bold tracking-tight">Mac Cleaner AI</h1>
                                <p className="text-white/60 text-lg leading-relaxed">
                                    Your intelligent assistant for a faster, cleaner, and safer Mac.
                                </p>
                            </div>

                            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm text-left space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/20 text-green-400 rounded-lg"><Smartphone size={20} /></div>
                                    <span className="font-medium">Runs 100% On-Device</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><CheckCircle size={20} /></div>
                                    <span className="font-medium">Private & Secure</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep('downloading')}
                                className="w-full py-4 bg-white text-black font-semibold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                            >
                                Setup Intelligence <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </motion.div>
                    )}

                    {step === 'downloading' && (
                        <motion.div
                            key="downloading"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="text-center space-y-8"
                        >
                            <div className="relative w-24 h-24 mx-auto">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-white/10" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                                    <path className="text-purple-500 transition-all duration-300 ease-out" strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Download size={24} className="text-purple-400 animate-bounce" />
                                </div>
                            </div>

                            <div>
                                <h2 className="text-2xl font-semibold mb-2">Installing Agent...</h2>
                                <p className="text-white/50 text-sm font-mono h-6">{progressText || "Initializing..."}</p>
                            </div>

                            <p className="text-white/30 text-xs max-w-xs mx-auto">
                                Downloading the Gemma 2 neural network. This ensures your data never leaves your device.
                            </p>
                        </motion.div>
                    )}

                    {step === 'complete' && (
                        <motion.div
                            key="complete"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center space-y-8"
                        >
                            <div className="w-24 h-24 bg-green-500 rounded-full mx-auto flex items-center justify-center shadow-2xl shadow-green-500/30">
                                <CheckCircle size={48} className="text-white" />
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-3xl font-bold">All Systems Operational</h2>
                                <p className="text-white/60">
                                    Mac Cleaner AI is ready to optimize your system.
                                </p>
                            </div>

                            <button
                                onClick={onComplete}
                                className="w-full py-4 bg-white text-black font-semibold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                Enter Dashboard
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
