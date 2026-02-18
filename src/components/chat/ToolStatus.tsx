import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, HardDrive, Shield, Zap, Search } from 'lucide-react';

interface ToolStatusProps {
    toolName: string;
    state: 'running' | 'completed' | 'failed';
}

export function ToolStatus({ toolName, state }: ToolStatusProps) {
    const getIcon = () => {
        if (toolName.includes('scan')) return Search;
        if (toolName.includes('clean')) return HardDrive;
        if (toolName.includes('malware')) return Shield;
        if (toolName.includes('optimize')) return Zap;
        return Loader2;
    };

    const Icon = getIcon();

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`
                flex items-center gap-3 px-4 py-3 rounded-xl border mb-2 w-fit
                ${state === 'running' ? 'bg-blue-500/10 border-blue-500/30 text-blue-200' : ''}
                ${state === 'completed' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : ''}
                ${state === 'failed' ? 'bg-red-500/10 border-red-500/30 text-red-200' : ''}
            `}
        >
            <div className="flex items-center gap-2">
                {state === 'running' ? (
                    <Loader2 size={14} className="animate-spin text-blue-400" />
                ) : (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                )}
                <Icon size={14} className="opacity-50" />
            </div>

            <span className="text-xs font-mono tracking-wide">
                {state === 'running' ? 'EXECUTING: ' : 'COMPLETED: '}
                <span className="font-bold uppercase">{toolName.replace(/_/g, ' ')}</span>
            </span>
        </motion.div>
    );
}
