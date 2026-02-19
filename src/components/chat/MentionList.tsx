import { motion, AnimatePresence } from 'framer-motion';
import { HardDrive, Cpu, Zap, Trash2, Folder, Keyboard } from 'lucide-react';

export interface MentionOption {
    id: string;
    label: string;
    icon: any;
    description: string;
    type: 'system' | 'path' | 'action';
}

interface MentionListProps {
    visible: boolean;
    filter: string;
    selectedIndex: number;
    onSelect: (option: MentionOption) => void;
    position: { x: number; y: number };
}

export const AVAILABLE_MENTIONS: MentionOption[] = [
    { id: 'system-junk', label: 'Junk', icon: Trash2, description: 'Caches & logs', type: 'system' },
    { id: 'large-files', label: 'Large Files', icon: HardDrive, description: '>50MB files', type: 'system' },
    { id: 'memory', label: 'Memory', icon: Zap, description: 'RAM usage', type: 'system' },
    { id: 'cpu', label: 'CPU', icon: Cpu, description: 'Processor load', type: 'system' },
    { id: 'downloads', label: 'Downloads', icon: Folder, description: '~/Downloads', type: 'path' },
    { id: 'applications', label: 'Applications', icon: Keyboard, description: '/Applications', type: 'path' },
];

export function MentionList({ visible, filter, selectedIndex, onSelect, position }: MentionListProps) {
    if (!visible) return null;

    const filtered = AVAILABLE_MENTIONS.filter(m =>
        m.label.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute z-50 bg-[#1e1135]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl w-64 overflow-hidden"
                style={{ bottom: position.y + 8, left: position.x }}
            >
                <div className="px-3 py-2 bg-white/5 border-b border-white/5 text-[10px] uppercase font-bold text-white/40 tracking-wider">
                    Suggested Context
                </div>
                <div className="max-h-60 overflow-y-auto p-1">
                    {filtered.map((item, i) => (
                        <button
                            key={item.id}
                            onClick={() => onSelect(item)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left group ${i === selectedIndex ? 'bg-blue-500/20 text-white' : 'text-white/70 hover:bg-white/5'
                                }`}
                        >
                            <div className={`p-1.5 rounded-md ${i === selectedIndex ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/60'
                                }`}>
                                <item.icon size={14} />
                            </div>
                            <div>
                                <div className="text-sm font-medium leading-none mb-1">@{item.label}</div>
                                <div className={`text-[10px] ${i === selectedIndex ? 'text-blue-200' : 'text-white/30'}`}>
                                    {item.description}
                                </div>
                            </div>
                            {i === selectedIndex && (
                                <div className="ml-auto text-[10px] text-white/40 font-mono">⏎</div>
                            )}
                        </button>
                    ))}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
