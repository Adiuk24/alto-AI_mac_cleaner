import { useState, useEffect, type ReactNode } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface AppLayoutProps {
    children: ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export function AppLayout({ children, activeTab, onTabChange }: AppLayoutProps) {
    const [notification, setNotification] = useState<string | null>(null);

    useEffect(() => {
        const handleAiMessage = (event: Event) => {
            const customEvent = event as CustomEvent<string>;
            setNotification(customEvent.detail);
            // Auto hide after 8 seconds
            const timer = setTimeout(() => setNotification(null), 8000);
            return () => clearTimeout(timer);
        };

        window.addEventListener('ai-proactive-message', handleAiMessage);
        return () => {
            window.removeEventListener('ai-proactive-message', handleAiMessage);
        };
    }, []);

    return (
        <div className="flex h-screen w-full overflow-hidden text-foreground selection:bg-purple-500/30 font-sans antialiased">
            <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
            <main className="flex-1 h-full overflow-auto relative bg-transparent">
                {/* Noise Texture Overlay */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-50 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat" />

                {/* Floating Assistant Button */}
                {activeTab !== 'assistant' && (
                    <div className="fixed top-4 right-4 z-40 flex flex-col items-end gap-2">
                        {notification && (
                            <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.9 }}
                                className="bg-card/80 backdrop-blur-md border border-pink-500/30 text-white px-4 py-3 rounded-2xl shadow-xl max-w-xs text-sm relative"
                            >
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-pink-500 rounded-full animate-pulse" />
                                <p>"{notification}"</p>
                                <button
                                    onClick={() => onTabChange('assistant')}
                                    className="mt-2 text-xs text-pink-400 hover:text-pink-300 font-medium"
                                >
                                    Chat with Assistant →
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setNotification(null); }}
                                    className="absolute top-1 right-2 text-white/30 hover:text-white"
                                >
                                    ×
                                </button>
                            </motion.div>
                        )}
                        <motion.button
                            onClick={() => onTabChange('assistant')}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/60 backdrop-blur-md border border-white/10 hover:border-pink-500/40 hover:bg-card/80 transition-all duration-300 shadow-lg group cursor-pointer"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse shadow-sm shadow-pink-400/50" />
                            <Sparkles size={14} className="text-pink-400 group-hover:text-pink-300" />
                            <span className="text-sm font-medium text-white/80 group-hover:text-white">Assistant</span>
                        </motion.button>
                    </div>
                )}

                {/* Background elements for depth */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                    <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-purple-600/10 blur-[120px] animate-pulse-slow" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[100px]" />
                    <div className="absolute top-[40%] left-[20%] w-[400px] h-[400px] rounded-full bg-pink-600/5 blur-[80px]" />
                </div>

                {children}
            </main>
        </div>
    );
}
