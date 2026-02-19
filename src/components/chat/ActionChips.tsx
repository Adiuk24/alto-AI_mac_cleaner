import { motion } from 'framer-motion';
import { ArrowRight, type LucideIcon } from 'lucide-react';

export interface ActionChip {
    label: string;
    icon?: LucideIcon;
    action: string; // Either a prompt string or a command like "navigate:dashboard"
}

interface ActionChipsProps {
    chips: ActionChip[];
    onAction: (action: string) => void;
}

export function ActionChips({ chips, onAction }: ActionChipsProps) {
    if (!chips || chips.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 mt-3">
            {chips.map((chip, i) => (
                <motion.button
                    key={i}
                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                    onClick={() => onAction(chip.action)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 text-[11px] text-blue-400 font-semibold transition-all group"
                >
                    {chip.icon && <chip.icon size={12} className="group-hover:scale-110 transition-transform" />}
                    {chip.label}
                    <ArrowRight size={10} className="opacity-40 group-hover:translate-x-0.5 transition-transform" />
                </motion.button>
            ))}
        </div>
    );
}
