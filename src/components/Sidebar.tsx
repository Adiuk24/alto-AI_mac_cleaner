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
        <div className="w-64 h-screen flex flex-col border-r border-white/10 bg-black/20 backdrop-blur-xl p-4 text-white">
            <div className="flex items-center gap-3 mb-8 px-2 pt-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <span className="font-bold text-white text-sm">A</span>
                </div>
                <span className="text-lg font-bold tracking-tight">Alto</span>
            </div>

            <nav className="flex-1 overflow-y-auto space-y-6">
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
                                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium relative group",
                                            isActive
                                                ? "text-white"
                                                : "text-white/60 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="sidebar-active"
                                                className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg border border-white/10"
                                                initial={false}
                                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                            />
                                        )}
                                        <span className="relative z-10 flex items-center gap-3 flex-1 min-w-0">
                                            <Icon size={18} className={cn(isActive ? "text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]" : "opacity-70 group-hover:opacity-100 group-hover:text-purple-300 transition-colors")} />
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
                    onClick={() => onTabChange('assistant')}
                    className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium",
                        activeTab === 'assistant'
                            ? "text-white bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-white/10"
                            : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                >
                    <Sparkles size={18} className={activeTab === 'assistant' ? "text-purple-400" : ""} />
                    AI Assistant
                </button>
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
    );
}
