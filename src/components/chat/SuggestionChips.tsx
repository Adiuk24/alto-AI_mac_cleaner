import { motion } from 'framer-motion';
import { Sparkles, Trash2, Shield, Zap } from 'lucide-react';

interface SuggestionChipsProps {
    onSelect: (text: string) => void;
}

export function SuggestionChips({ onSelect }: SuggestionChipsProps) {
    const suggestions = [
        { label: "Scan for Junk", icon: Trash2, prompt: "Scan my system for junk files" },
        { label: "Check Malware", icon: Shield, prompt: "Run a quick malware check" },
        { label: "Optimize Speed", icon: Zap, prompt: "How can I speed up my Mac?" },
        { label: "Deep Clean", icon: Sparkles, prompt: "Perform a deep system cleaning" },
    ];

    return (
        <div className="flex flex-wrap gap-2 mt-4">
            {suggestions.map((s, i) => (
                <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => onSelect(s.prompt)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-purple-500/30 transition-all text-xs text-white/70 hover:text-white"
                >
                    <s.icon size={14} className="text-purple-400" />
                    {s.label}
                </motion.button>
            ))}
        </div>
    );
}
