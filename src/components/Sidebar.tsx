import { LayoutDashboard, Trash2, Shield, Zap, Hammer, HardDrive, Files, Settings, Sparkles, RefreshCw, Puzzle, FileX, Mail, Eye } from 'lucide-react';
import { cn } from '../utils/cn';
import { motion } from 'framer-motion';
import { useScanStore } from '../store/scanStore';
import { formatBytes } from '../utils/formatBytes';

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
    const { junkResult, largeFilesResult } = useScanStore();

    const menuCategories = [
        {
            title: "Smart Scan",
            items: [
                { id: 'dashboard', label: 'Smart Scan', icon: LayoutDashboard },
            ]
        },
        {
            title: "Cleanup",
            items: [
                { id: 'system-junk', label: 'System Junk', icon: Trash2, badge: junkResult?.total_size_bytes },
                { id: 'mail', label: 'Mail Attachments', icon: Mail },
                { id: 'trash-bins', label: 'Trash Bins', icon: Trash2 },
            ]
        },
        {
            title: "Protection",
            items: [
                { id: 'malware', label: 'Malware Removal', icon: Shield },
                { id: 'privacy', label: 'Privacy', icon: Eye },
            ]
        },
        {
            title: "Speed",
            items: [
                { id: 'optimization', label: 'Optimization', icon: Zap },
                { id: 'maintenance', label: 'Maintenance', icon: Hammer },
            ]
        },
        {
            title: "Applications",
            items: [
                { id: 'uninstaller', label: 'Uninstaller', icon: Trash2 },
                { id: 'updater', label: 'Updater', icon: RefreshCw },
                { id: 'extensions', label: 'Extensions', icon: Puzzle },
            ]
        },
        {
            title: "Files",
            items: [
                { id: 'space-lens', label: 'Space Lens', icon: HardDrive },
                { id: 'large-files', label: 'Large & Old Files', icon: Files, badge: largeFilesResult?.total_size_bytes },
                { id: 'shredder', label: 'Shredder', icon: FileX },
            ]
        }
    ];

    return (
        <motion.div
            initial={{ x: -250, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-screen flex-shrink-0 z-50"
        >
            <div className="w-64 h-full flex flex-col glass text-white relative">
                {/* Logo Area - Clean & Minimal */}
                <div className="flex items-center gap-3 mb-8 px-6 pt-6">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/20 ring-1 ring-white/20">
                        <span className="text-sm font-bold text-white">A</span>
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-tight opacity-90">
                        Alto
                    </h1>
                </div>

                <nav className="flex-1 overflow-y-auto space-y-6 px-3">

                    {/* Primary AI Action */}
                    <button
                        onClick={() => onTabChange('assistant')}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 text-sm font-bold relative group shadow-lg",
                            activeTab === 'assistant'
                                ? "text-white bg-gradient-to-r from-pink-600 to-purple-600 border border-white/20 shadow-pink-500/20"
                                : "text-white/90 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20"
                        )}
                    >
                        <div className={cn(
                            "absolute inset-0 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 opacity-0 transition-opacity duration-300",
                            activeTab === 'assistant' ? "opacity-0" : "group-hover:opacity-10"
                        )} />

                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-300">
                            <Sparkles size={16} className={activeTab === 'assistant' ? "text-white" : "text-pink-400"} />
                        </div>
                        <span className="tracking-wide">Chat with Alto</span>
                        {activeTab === 'assistant' && (
                            <motion.div
                                layoutId="sidebar-glow"
                                className="absolute inset-0 rounded-xl bg-white/20 blur-lg -z-10"
                                transition={{ duration: 0.3 }}
                            />
                        )}
                    </button>

                    {menuCategories.map((category, idx) => (
                        <div key={idx}>
                            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-2">
                                {category.title}
                            </h3>
                            <div className="space-y-1">
                                {category.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = activeTab === item.id;
                                    const badge = (item as any).badge;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => onTabChange(item.id)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium relative group active:scale-95",
                                                isActive
                                                    ? "text-white"
                                                    : "text-white/60 hover:text-white hover:bg-white/5"
                                            )}
                                        >
                                            {isActive && (
                                                <motion.div
                                                    layoutId="sidebar-active"
                                                    className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent rounded-lg border-l-2 border-pink-500"
                                                    initial={false}
                                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                />
                                            )}
                                            <span className="relative z-10 flex items-center gap-3 flex-1 min-w-0">
                                                <Icon size={18} className={cn(isActive ? "text-pink-400" : "opacity-70 group-hover:opacity-100 group-hover:text-pink-300 transition-colors")} />
                                                <span className="truncate">{item.label}</span>
                                                {badge != null && badge > 0 && (
                                                    <span className="ml-auto text-[11px] font-mono text-white/40 shrink-0">
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

                <div className="mt-auto pt-4 border-t border-white/10 space-y-1">
                    <button
                        onClick={() => onTabChange('settings')}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5",
                            activeTab === 'settings' && "text-white bg-white/5"
                        )}
                    >
                        <Settings size={18} />
                        Settings
                    </button>
                </div>
            </div>
        </motion.div>

    );
}
