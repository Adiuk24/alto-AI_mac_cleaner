import { motion } from 'framer-motion';
import { BrainCircuit } from 'lucide-react';

interface ThinkingIndicatorProps {
    status?: string;
}

export function ThinkingIndicator({ status }: ThinkingIndicatorProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 w-fit max-w-[80%]"
        >
            <div className="relative w-8 h-8 flex items-center justify-center">
                <div className="absolute inset-0 bg-purple-500/20 rounded-full animate-ping" />
                <BrainCircuit size={18} className="text-purple-400 relative z-10" />
            </div>
            <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-white/90">Thinking...</span>
                <span className="text-[10px] text-white/40 animate-pulse font-mono truncate max-w-[200px]">
                    {status || "Analyzing context & tools"}
                </span>
            </div>
        </motion.div>
    );
}
