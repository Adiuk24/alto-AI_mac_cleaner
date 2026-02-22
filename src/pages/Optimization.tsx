import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Zap, Power, Cpu, Search, ArrowLeft, Activity, ChevronRight, Sparkles } from 'lucide-react';
import { playCompletionSound } from '../utils/sounds';
import { cn } from '../utils/cn';

// Mock data for the UI to match screenshot
const CATEGORIES = [
    { id: 'login_items', label: 'Login Items', icon: Power, count: 4 },
    { id: 'launch_agents', label: 'Launch Agents', icon: Zap, count: 12 },
    { id: 'heavy_consumers', label: 'Heavy Consumers', icon: Cpu, count: 2 },
    { id: 'hung_applications', label: 'Hung Applications', icon: Settings, count: 0 },
];

const MOCK_ITEMS: Record<string, any[]> = {
    'login_items': [
        { id: 1, name: 'Spotify', icon: '🎵', status: 'Enabled' },
        { id: 2, name: 'Dropbox', icon: '📦', status: 'Enabled' },
        { id: 3, name: 'Docker', icon: '🐳', status: 'Disabled' },
        { id: 4, name: 'Creative Cloud', icon: '☁️', status: 'Enabled' },
    ],
    'launch_agents': [
        { id: 5, name: 'zoom.us Agent', icon: '🎥', status: 'Enabled' },
        { id: 6, name: 'us.zoom.ZoomDaemon', icon: '🎥', status: 'Disabled' },
        { id: 7, name: 'OneDrive Agent', icon: '☁️', status: 'Enabled' },
        { id: 8, name: 'Microsoft AutoUpdate', icon: '📝', status: 'Enabled' },
        { id: 9, name: 'Google Chrome Updater', icon: '🌐', status: 'Enabled' },
        { id: 10, name: 'Adobe Creative Cloud', icon: '🎨', status: 'Disabled' },
    ],
    'heavy_consumers': [
        { id: 11, name: 'Figma Renderer', icon: '🎨', status: 'High CPU' },
        { id: 12, name: 'WindowServer', icon: '🖥️', status: 'High Memory' },
    ],
    'hung_applications': []
};

export function Optimization() {
    // const { call } = useTauri(); // Kept for future integration
    const [viewState, setViewState] = useState<'landing' | 'detail'>('landing');
    const [selectedCategory, setSelectedCategory] = useState('launch_agents');
    const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

    const totalItems = Object.values(MOCK_ITEMS).reduce((acc, list) => acc + list.length, 0);
    console.log('Total items for optimization:', totalItems);

    const toggleItem = (id: number) => {
        setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handlePerform = () => {
        playCompletionSound();
        // Here we would call the backend to disable/remove items
        console.log('Performing optimization on:', checkedItems);
    };

    return (
        <div className="h-full w-full bg-transparent text-white overflow-hidden relative font-sans">
            <AnimatePresence mode="wait">
                {viewState === 'landing' ? (
                    <motion.div
                        key="landing"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98, x: -50 }}
                        className="h-full flex items-center justify-center p-12 relative z-10"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 w-full max-w-5xl items-center">
                            {/* Left Content */}
                            <div className="text-left space-y-10">
                                <div className="space-y-4">
                                    <h1 className="text-6xl font-black text-white uppercase tracking-tighter shimmer-text">Optimization</h1>
                                    <p className="text-xl text-white/40 leading-relaxed max-w-md font-medium">
                                        Surge your productivity by maintaining total control over your background ecosystem.
                                    </p>
                                </div>

                                <div className="space-y-8">
                                    <div className="flex gap-6 group">
                                        <div className="w-14 h-14 rounded-2xl glass-frost flex items-center justify-center shrink-0 border border-white/10 group-hover:shadow-primary/20 transition-all duration-500">
                                            <Zap className="text-primary w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg tracking-wide">Launch Management</h3>
                                            <p className="text-sm text-white/40 mt-1 leading-relaxed">Stay in command of the silent agents that tether your performance.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-6 group">
                                        <div className="w-14 h-14 rounded-2xl glass-frost flex items-center justify-center shrink-0 border border-white/10 group-hover:shadow-purple-400/20 transition-all duration-500">
                                            <Activity className="text-purple-400 w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg tracking-wide">Consumer Insight</h3>
                                            <p className="text-sm text-white/40 mt-1 leading-relaxed">Identify and neutralize high-memory hungriness instantly.</p>
                                        </div>
                                    </div>
                                </div>

                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                >
                                    <button
                                        onClick={() => setViewState('detail')}
                                        className="btn-scan"
                                    >
                                        Inspect
                                    </button>
                                </motion.div>
                            </div>

                            {/* Right Graphic */}
                            <div className="flex items-center justify-center">
                                <div className="relative w-80 h-80 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-[80px] animate-pulse" />
                                    <div className="relative w-72 h-72 rounded-[3.5rem] glass-frost border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden group">
                                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                        {/* Slider Graphic Sim */}
                                        <div className="flex gap-8 items-center justify-center relative z-10">
                                            {[0.7, 0.4, 0.8].map((val, i) => (
                                                <div key={i} className="w-2.5 h-40 bg-white/5 rounded-full relative">
                                                    <motion.div
                                                        className="absolute w-10 h-10 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)] left-1/2 -translate-x-1/2 ring-2 ring-white/20"
                                                        initial={{ bottom: `${val * 100}%` }}
                                                        animate={{ bottom: [`${val * 100}%`, `${(val + 0.1) * 100}%`, `${val * 100}%`] }}
                                                        transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut" }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="detail"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        className="h-full flex flex-col"
                    >
                        {/* Header */}
                        <div className="h-20 border-b border-white/5 flex items-center px-8 justify-between shrink-0 glass-frost z-10">
                            <button
                                onClick={() => setViewState('landing')}
                                className="flex items-center gap-3 text-white/30 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl"
                            >
                                <ArrowLeft size={18} />
                                <span className="text-xs font-bold uppercase tracking-widest">Back</span>
                            </button>

                            <div className="flex items-center gap-6">
                                <div className="relative">
                                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                                    <input
                                        type="text"
                                        placeholder="Filter utilities..."
                                        className="bg-white/5 border border-white/10 rounded-full pl-10 pr-6 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/50 w-56 transition-all focus:w-80"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Sidebar Categories */}
                            <div className="w-80 border-r border-white/5 p-6 space-y-3 overflow-y-auto bg-black/10">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={cn(
                                            "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 relative group active:scale-[0.98]",
                                            selectedCategory === cat.id
                                                ? "glass-frost text-white shadow-xl"
                                                : "text-white/40 hover:bg-white/5 hover:text-white/80"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500",
                                            selectedCategory === cat.id ? "bg-primary/20 text-primary" : "bg-white/5 text-white/20 group-hover:text-white/40"
                                        )}>
                                            <cat.icon size={20} />
                                        </div>
                                        <span className="flex-1 text-left text-sm font-bold tracking-wide">{cat.label}</span>
                                        {cat.count > 0 && (
                                            <span className="text-[10px] font-black bg-white/5 px-2 py-0.5 rounded-full text-white/30">{cat.count}</span>
                                        )}
                                        {selectedCategory === cat.id && (
                                            <motion.div layoutId="cat-indicator" className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-full" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Main List */}
                            <div className="flex-1 flex flex-col bg-transparent overflow-hidden">
                                <div className="p-10 pb-6">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="w-1.5 h-8 bg-primary/40 rounded-full" />
                                        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{CATEGORIES.find(c => c.id === selectedCategory)?.label}</h2>
                                    </div>
                                    <p className="text-lg text-white/40 font-medium max-w-3xl leading-relaxed">
                                        These agents are auxiliary components that enable peripheral features. Disabling them can reclaim CPU cycles and sharpen your system responsiveness.
                                    </p>
                                </div>

                                <div className="flex-1 overflow-y-auto px-10 pb-32 custom-scrollbar">
                                    <div className="space-y-2">
                                        {MOCK_ITEMS[selectedCategory]?.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() => toggleItem(item.id)}
                                                className="group flex items-center justify-between py-4 px-6 rounded-2xl hover:bg-white/5 transition-all duration-300 border border-transparent hover:border-white/5 cursor-pointer active:scale-[0.99]"
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className={cn(
                                                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                                                        checkedItems[item.id] ? "bg-primary border-primary shadow-[0_0_10px_rgba(236,72,153,0.4)]" : "border-white/10 group-hover:border-white/30"
                                                    )}>
                                                        {checkedItems[item.id] && <div className="w-2 h-2 bg-white rounded-full" />}
                                                    </div>
                                                    <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-2xl shadow-inner ring-1 ring-white/5 transform group-hover:scale-110 transition-transform duration-500">
                                                        {item.icon}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-base font-bold text-white tracking-wide">{item.name}</span>
                                                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.1em] mt-0.5">Application Resident</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-500",
                                                        item.status === 'Enabled' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]" : "bg-white/5 text-white/20 border-white/5"
                                                    )}>
                                                        {item.status}
                                                    </div>
                                                    <ChevronRight size={18} className="text-white/5 group-hover:text-white/20 transition-colors" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Floating Action Button */}
                                <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
                                    <button
                                        onClick={handlePerform}
                                        className="btn-scan px-12"
                                    >
                                        <div className="flex items-center gap-4">
                                            <Sparkles size={20} className="text-white" />
                                            <span>Optimize</span>
                                            {Object.keys(checkedItems).filter(k => checkedItems[Number(k)]).length > 0 && (
                                                <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full">
                                                    {Object.keys(checkedItems).filter(k => checkedItems[Number(k)]).length}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}


