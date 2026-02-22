import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, HardDrive, Shield, Zap, Search, Trash2, Mail, Wrench, Lock } from 'lucide-react';

interface ToolStatusProps {
    toolName: string;
    label?: string; // Human readable step description
    state: 'running' | 'completed' | 'failed';
}

export function ToolStatus({ toolName, label, state }: ToolStatusProps) {
    const getIcon = () => {
        if (toolName.includes('trash') || toolName.includes('empty')) return Trash2;
        if (toolName.includes('mail')) return Mail;
        if (toolName.includes('privacy') || toolName.includes('shred')) return Lock;
        if (toolName.includes('maintenance') || toolName.includes('repair')) return Wrench;
        if (toolName.includes('scan')) return Search;
        if (toolName.includes('clean')) return HardDrive;
        if (toolName.includes('malware') || toolName.includes('security')) return Shield;
        if (toolName.includes('optimize') || toolName.includes('speed')) return Zap;
        return Loader2;
    };

    const Icon = getIcon();

    const displayLabel = label || toolName.replace(/_/g, ' ');

    return (
        <motion.div
            initial={{ opacity: 0, x: -8, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={`
                flex items-center gap-3 px-4 py-2.5 rounded-xl border mb-1.5 w-fit max-w-sm
                ${state === 'running' ? 'bg-blue-500/10 border-blue-500/20 text-blue-200' : ''}
                ${state === 'completed' ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-300/80' : ''}
                ${state === 'failed' ? 'bg-red-500/10 border-red-500/20 text-red-200' : ''}
            `}
        >
            {state === 'running' ? (
                <Loader2 size={13} className="animate-spin text-blue-400 shrink-0" />
            ) : state === 'failed' ? (
                <Icon size={13} className="text-red-400 shrink-0" />
            ) : (
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            )}

            <span className="text-xs font-mono tracking-wide leading-none">
                {state === 'running' ? (
                    <><span className="text-blue-400/70 mr-1.5">▶</span>{displayLabel}<span className="animate-pulse">...</span></>
                ) : (
                    <span className="opacity-70 capitalize">{displayLabel}</span>
                )}
            </span>
        </motion.div>
    );
}
