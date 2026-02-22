import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';

interface AiInsightProps {
    insight: { summary: string; detail: string; action: string; } | null;
    loading: boolean;
}

export function AiInsight({ insight, loading }: AiInsightProps) {
    if (!insight && !loading) return null;

    // Typewriter effect state
    const [displayedSummary, setDisplayedSummary] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        if (insight?.summary) {
            setIsTyping(true);
            setDisplayedSummary('');
            let i = 0;
            const timer = setInterval(() => {
                setDisplayedSummary(insight.summary.slice(0, i + 1));
                i++;
                if (i >= insight.summary.length) {
                    clearInterval(timer);
                    setIsTyping(false);
                }
            }, 30); // Speed of typing
            return () => clearInterval(timer);
        }
    }, [insight?.summary]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto my-6 p-1 rounded-2xl bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500"
        >
            <div className="bg-background/90 backdrop-blur-xl rounded-xl p-6 flex items-start gap-4">
                <div className="p-3 bg-linear-to-br from-pink-500 to-purple-600 rounded-xl text-white shrink-0 shadow-lg shadow-purple-500/20">
                    <Sparkles className={loading || isTyping ? "animate-spin-slow" : ""} size={24} />
                </div>
                <div className="flex-1 text-left">
                    <h3 className="text-sm font-bold bg-clip-text text-transparent bg-linear-to-r from-pink-500 to-purple-500 mb-1 uppercase tracking-wider">
                        AI Analysis
                    </h3>
                    {loading ? (
                        <div className="space-y-2 mt-2">
                            <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
                            <div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-lg font-semibold text-white leading-tight">
                                {displayedSummary}
                                {isTyping && <span className="inline-block w-1.5 h-5 ml-1 bg-purple-400 animate-pulse align-middle" />}
                            </p>
                            {!isTyping && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                                    <p className="text-sm text-white/60 leading-relaxed">
                                        {insight?.detail}
                                    </p>
                                    {insight?.action && (
                                        <div className="pt-2">
                                            <span className="text-xs font-medium text-purple-300 bg-purple-500/10 px-2 py-1 rounded-md border border-purple-500/20">
                                                Suggestion: {insight.action}
                                            </span>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
