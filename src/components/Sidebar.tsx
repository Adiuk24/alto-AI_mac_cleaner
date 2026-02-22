import {
    LayoutDashboard,
    Trash2,
    Shield,
    Zap,
    Hammer,
    HardDrive,
    Files,
    Settings,
    Sparkles,
    RefreshCw,
    Puzzle,
    FileX,
    Mail,
    Eye,
    HelpCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useScanStore } from '../store/scanStore';
import { formatBytes } from '../utils/formatBytes';
import { cn } from '../utils/cn';

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
    const { junkResult, largeFilesResult } = useScanStore();

    const menuCategories = [
        {
            title: "Cleanup",
            items: [
                { id: 'dashboard', label: 'Smart Scan', icon: LayoutDashboard, color: 'text-blue-400' },
                { id: 'system-junk', label: 'System Junk', icon: Trash2, badge: junkResult?.total_size_bytes, color: 'text-blue-400' },
                { id: 'mail', label: 'Mail Attachments', icon: Mail, color: 'text-blue-400' },
                { id: 'trash-bins', label: 'Trash Bins', icon: Trash2, color: 'text-blue-400' },
            ]
        },
        {
            title: "Protection",
            items: [
                { id: 'malware', label: 'Malware Removal', icon: Shield, color: 'text-emerald-400' },
                { id: 'privacy', label: 'Privacy', icon: Eye, color: 'text-emerald-400' },
            ]
        },
        {
            title: "Performance",
            items: [
                { id: 'optimization', label: 'Optimization', icon: Zap, color: 'text-pink-400' },
                { id: 'maintenance', label: 'Maintenance', icon: Hammer, color: 'text-pink-400' },
            ]
        },
        {
            title: "Applications",
            items: [
                { id: 'uninstaller', label: 'Uninstaller', icon: Trash2, color: 'text-orange-400' },
                { id: 'updater', label: 'Updater', icon: RefreshCw, color: 'text-orange-400' },
                { id: 'extensions', label: 'Extensions', icon: Puzzle, color: 'text-orange-400' },
            ]
        },
        {
            title: "Files",
            items: [
                { id: 'space-lens', label: 'Space Lens', icon: HardDrive, color: 'text-purple-400' },
                { id: 'large-files', label: 'Large & Old Files', icon: Files, badge: largeFilesResult?.total_size_bytes, color: 'text-purple-400' },
                { id: 'shredder', label: 'Shredder', icon: FileX, color: 'text-purple-400' },
            ]
        }
    ];

    return (
        <motion.div
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="h-screen flex-shrink-0 z-50 p-4 pr-0"
        >
            <div className="w-64 h-full flex flex-col glass-frost rounded-3xl text-white relative border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                {/* Logo Area */}
                <div className="flex items-center gap-3 px-6 py-8">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/20 ring-1 ring-white/20">
                        <Zap size={20} className="text-white fill-white" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black text-white tracking-widest uppercase italic">
                            Alto
                        </h1>
                        <span className="text-[9px] font-mono text-white/30 tracking-[0.3em] uppercase -mt-1">Intelligent Agent</span>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto space-y-8 px-4 custom-scrollbar pb-6">
                    {/* Primary AI Action */}
                    <button
                        onClick={() => onTabChange('assistant')}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 text-sm font-bold relative group overflow-hidden",
                            activeTab === 'assistant'
                                ? "text-white shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                                : "text-white/60 hover:text-white"
                        )}
                    >
                        {activeTab === 'assistant' ? (
                            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary to-purple-600 opacity-90" />
                        ) : (
                            <div className="absolute inset-0 rounded-2xl bg-white/5 group-hover:bg-white/10 transition-colors" />
                        )}

                        <div className="relative z-10 w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shadow-inner">
                            <Sparkles size={18} className={activeTab === 'assistant' ? "text-white" : "text-primary"} />
                        </div>
                        <span className="relative z-10 tracking-wide text-base">Ask Alto</span>
                    </button>

                    {menuCategories.map((category, idx) => (
                        <div key={idx} className="space-y-2">
                            <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] px-4">
                                {category.title}
                            </h3>
                            <div className="space-y-1">
                                {category.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = activeTab === item.id;
                                    const badge = (item as any).badge;
                                    const itemColor = (item as any).color || 'text-white/60';

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => onTabChange(item.id)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 text-[13.5px] font-semibold relative group active:scale-95",
                                                isActive
                                                    ? "text-white bg-white/10 shadow-sm"
                                                    : "text-white/50 hover:text-white"
                                            )}
                                        >
                                            {isActive && (
                                                <motion.div
                                                    layoutId="sidebar-active-indicator"
                                                    className="absolute left-0 top-2 bottom-2 w-1.5 bg-primary rounded-full"
                                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                />
                                            )}

                                            <span className="relative z-10 flex items-center gap-3 flex-1 min-w-0">
                                                <Icon size={18} className={cn(isActive ? "text-white" : cn(itemColor, "opacity-50 group-hover:opacity-100 transition-all"))} />
                                                <span className="truncate tracking-wide">{item.label}</span>
                                                {badge != null && badge > 0 && (
                                                    <span className="ml-auto text-[9px] font-bold text-white/30 group-hover:text-white/50 transition-colors bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                                                        {formatBytes(badge)}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="px-4 py-6 border-t border-white/5 bg-black/20 space-y-1">
                    <button
                        type="button"
                        onClick={() => onTabChange('help')}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                            activeTab === 'help' ? "text-white bg-white/10" : "text-white/40 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <HelpCircle size={18} />
                        Help
                    </button>
                    <button
                        onClick={() => onTabChange('settings')}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm font-bold text-white/30 hover:text-white hover:bg-white/5 group",
                            activeTab === 'settings' && "text-white bg-white/10 shadow-none"
                        )}
                    >
                        <Settings size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                        Settings
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
