import { useState } from 'react';
// import { useTauri } from '../hooks/useTauri'; // Kept for future integration if needed, but commenting out to fix lint
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Zap, Power, Cpu, Search, ArrowLeft, Activity } from 'lucide-react';
import { playCompletionSound } from '../utils/sounds';

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

    const toggleItem = (id: number) => {
        setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handlePerform = () => {
        playCompletionSound();
        // Here we would call the backend to disable/remove items
        console.log('Performing optimization on:', checkedItems);
    };

    return (
        <div className="h-full w-full bg-[#1E1E2E] text-white overflow-hidden relative font-sans">
            <AnimatePresence mode="wait">
                {viewState === 'landing' ? (
                    <motion.div
                        key="landing"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, x: -50 }}
                        className="h-full flex items-center justify-center p-12"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full max-w-5xl items-center">
                            {/* Left Content */}
                            <div className="text-left space-y-8">
                                <div>
                                    <h1 className="text-4xl font-bold mb-4">Optimization</h1>
                                    <p className="text-lg text-white/60 leading-relaxed">
                                        Increase your Mac's output by staying in control of what's running on it.
                                    </p>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                                            <Settings className="text-pink-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white/90">Manage the launch agents of your apps</h3>
                                            <p className="text-sm text-white/50">Stay in charge of the supporting applications on your Mac.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                                            <Activity className="text-purple-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white/90">Take control of what you're running</h3>
                                            <p className="text-sm text-white/50">Manage all of your login items to run only what you truly need.</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setViewState('detail')}
                                    className="px-8 py-3 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium transition-colors shadow-lg shadow-blue-500/30"
                                >
                                    View All {totalItems} Items...
                                </button>
                            </div>

                            {/* Right Graphic */}
                            <div className="flex items-center justify-center">
                                <div className="relative w-80 h-80 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
                                    <div className="absolute inset-4 rounded-full border border-white/20" />
                                    {/* Fader/Slider Graphic Simulation */}
                                    <div className="flex gap-6 items-center justify-center">
                                        {[0.7, 0.4, 0.8].map((val, i) => (
                                            <div key={i} className="w-2 h-32 bg-white/20 rounded-full relative">
                                                <motion.div
                                                    className="absolute w-8 h-8 bg-white rounded-full shadow-lg left-1/2 -translate-x-1/2"
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
                        <div className="h-16 border-b border-white/10 flex items-center px-6 justify-between shrink-0 bg-[#1E1E2E]/50 backdrop-blur-md z-10">
                            <button
                                onClick={() => setViewState('landing')}
                                className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                            >
                                <ArrowLeft size={18} />
                                <span className="text-sm font-medium">Back</span>
                            </button>

                            <div className="flex items-center gap-4">
                                <span className="text-sm text-white/40">Sort by Name ▾</span>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                                    <input
                                        type="text"
                                        placeholder="Search"
                                        className="bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 w-48 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Sidebar Categories */}
                            <div className="w-64 border-r border-white/10 p-4 space-y-2 overflow-y-auto bg-[#181825]">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${selectedCategory === cat.id
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                                            }`}
                                    >
                                        <cat.icon size={18} />
                                        <span className="flex-1 text-left text-sm font-medium">{cat.label}</span>
                                        {cat.count > 0 && (
                                            <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-white/70">{cat.count}</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Main List */}
                            <div className="flex-1 flex flex-col bg-[#1E1E2E] overflow-hidden">
                                <div className="p-8 pb-4">
                                    <h2 className="text-2xl font-bold mb-2">{CATEGORIES.find(c => c.id === selectedCategory)?.label}</h2>
                                    <p className="text-white/50 text-sm max-w-2xl">
                                        Mostly, these are small satellite applications of other software products that you have. They broaden the functionality of the main product, but in some cases you may consider removing or disabling them.
                                    </p>
                                </div>

                                <div className="flex-1 overflow-y-auto px-8 pb-20">
                                    <div className="space-y-1">
                                        {MOCK_ITEMS[selectedCategory]?.map((item) => (
                                            <div key={item.id} className="group flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={() => toggleItem(item.id)}
                                                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${checkedItems[item.id]
                                                            ? 'bg-blue-500 border-blue-500'
                                                            : 'border-white/20 hover:border-white/40'
                                                            }`}
                                                    >
                                                        {checkedItems[item.id] && <div className="w-2 h-2 bg-white rounded-full" />}
                                                    </button>
                                                    <div className="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center text-lg">
                                                        {item.icon}
                                                    </div>
                                                    <span className="text-sm font-medium text-white/90">{item.name}</span>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${item.status === 'Enabled' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-white/20'
                                                        }`} />
                                                    <span className={`text-sm ${item.status === 'Enabled' ? 'text-white/90' : 'text-white/40'
                                                        }`}>{item.status}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Floating Action Button */}
                                <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handlePerform}
                                        className="px-8 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md shadow-xl text-white font-medium flex items-center gap-2"
                                    >
                                        <span>Perform</span>
                                        {Object.keys(checkedItems).filter(k => checkedItems[Number(k)]).length > 0 && (
                                            <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                                {Object.keys(checkedItems).filter(k => checkedItems[Number(k)]).length}
                                            </span>
                                        )}
                                    </motion.button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}


