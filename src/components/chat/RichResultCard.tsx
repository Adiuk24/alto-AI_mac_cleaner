import { motion } from 'framer-motion';
import { HardDrive, ExternalLink } from 'lucide-react';
import { formatBytes } from '../../utils/formatBytes';
import type { ScannedItem } from '../../types';

interface RichResultCardProps {
    items: ScannedItem[];
    totalSize: number;
    title: string;
    onViewItem?: (path: string) => void;
}

export function RichResultCard({ items, totalSize, title, onViewItem }: RichResultCardProps) {
    // Sort by size and take top 5
    const topItems = [...items].sort((a, b) => b.size_bytes - a.size_bytes).slice(0, 5);

    if (items.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-sm bg-[#1E1E2E]/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl my-3 group"
        >
            <div className="px-4 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/20">
                        <HardDrive size={14} className="text-blue-400" />
                    </div>
                    <span className="font-semibold text-xs text-white/90">{title}</span>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                    <span className="text-[10px] font-mono text-white/60">{formatBytes(totalSize)}</span>
                </div>
            </div>

            <div className="p-2 space-y-1">
                {topItems.map((item, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer group/item"
                        onClick={() => onViewItem?.(item.path)}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover/item:bg-blue-500/20 transition-colors">
                                <span className="text-[10px] text-white/30 font-bold group-hover/item:text-blue-400">{i + 1}</span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] text-white/80 font-medium truncate">
                                    {item.path.split('/').pop() || item.path}
                                </p>
                                <p className="text-[9px] text-white/30 truncate max-w-[180px] font-mono">
                                    {item.path}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-white/40">{formatBytes(item.size_bytes)}</span>
                            <ExternalLink size={10} className="text-white/0 group-hover/item:text-white/40 transition-colors" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="px-4 py-2 bg-white/5 border-t border-white/5 flex items-center justify-between">
                <span className="text-[9px] text-white/20 uppercase tracking-widest font-bold">Top Offenders</span>
                <span className="text-[9px] text-white/20 italic">Interactive Preview</span>
            </div>
        </motion.div>
    );
}
