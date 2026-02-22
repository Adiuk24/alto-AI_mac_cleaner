import { Trash2, CheckCircle, ArrowLeft, Search, Layers, Sparkles, ChevronRight } from 'lucide-react';
import { useScanStore } from '../store/scanStore';
import { useTauri } from '../hooks/useTauri';
import { useState, useMemo } from 'react';
import { formatBytes } from '../utils/formatBytes';
import { playCompletionSound } from '../utils/sounds';
import { Virtuoso } from 'react-virtuoso';
import { motion, AnimatePresence } from 'framer-motion';

type ViewState = 'pre-scan' | 'scanning' | 'summary' | 'detail';

interface GroupedCategory {
    name: string;
    items: any[];
    totalSize: number;
}

export function SystemJunk() {
    const {
        junkResult,
        startJunkScan,
        finishJunkScan,
        selectedJunkItems,
        toggleJunkItem,
        setAllJunkItems
    } = useScanStore();
    const { call } = useTauri();
    const [cleaning, setCleaning] = useState(false);
    const [viewState, setViewState] = useState<ViewState>(junkResult ? 'summary' : 'pre-scan');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'size' | 'name'>('size');

    const handleScan = async () => {
        setViewState('scanning');
        startJunkScan();
        // Simulate scan delay for effect if mostly empty or fast
        // await new Promise(r => setTimeout(r, 1000)); 
        const result = await call<any>('scan_junk_command');
        if (result) {
            finishJunkScan(result);
            setViewState('summary');
            playCompletionSound();
        }
    };

    const handleClean = async () => {
        if (!junkResult || selectedJunkItems.size === 0) return;
        setCleaning(true);
        const paths = Array.from(selectedJunkItems);
        await call('clean_items', { paths });
        setCleaning(false);
        handleScan(); // Rescan to refresh
    };

    // Group items by category
    const groupedCategories: GroupedCategory[] = useMemo(() => {
        if (!junkResult) return [];
        const groups: Record<string, any[]> = {};
        junkResult.items.forEach(item => {
            const cat = item.category_name || 'Other';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });
        return Object.entries(groups)
            .map(([name, items]) => ({ name, items, totalSize: items.reduce((s, i) => s + i.size_bytes, 0) }))
            .sort((a, b) => b.totalSize - a.totalSize);
    }, [junkResult]);

    const selectedSize = useMemo(() => {
        if (!junkResult) return 0;
        return junkResult.items
            .filter(i => selectedJunkItems.has(i.path))
            .reduce((s, i) => s + i.size_bytes, 0);
    }, [junkResult, selectedJunkItems]);

    const toggleCategory = (categoryName: string) => {
        const category = groupedCategories.find(c => c.name === categoryName);
        if (!category) return;
        const categoryPaths = category.items.map(i => i.path);
        const allSelected = categoryPaths.every(p => selectedJunkItems.has(p));

        const next = new Set(selectedJunkItems);
        categoryPaths.forEach(p => {
            if (allSelected) next.delete(p);
            else next.add(p);
        });
        setAllJunkItems(next);
    };

    return (
        <div className="h-full w-full overflow-hidden relative font-sans bg-transparent">
            {/* Background decorative elements - kept for depth but made subtler */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-pink-600/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[100px] pointer-events-none" />

            <AnimatePresence mode="wait">
                {/* ── Pre-scan state ── */}
                {viewState === 'pre-scan' && (
                    <motion.div
                        key="pre-scan"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="h-full flex items-center justify-center p-12 relative z-10"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 w-full max-w-5xl items-center">
                            <div className="space-y-10">
                                <div>
                                    <h1 className="text-5xl font-black text-white mb-6 uppercase tracking-tighter shimmer-text">
                                        System Junk
                                    </h1>
                                    <p className="text-lg text-white/40 leading-relaxed max-w-md">
                                        Reclaim lost space and optimize your system by removing internal clutter that slows you down.
                                    </p>
                                </div>

                                <div className="space-y-8">
                                    <div className="flex gap-6 group">
                                        <div className="w-14 h-14 rounded-2xl glass-frost flex items-center justify-center shrink-0 border border-white/10 shadow-lg group-hover:shadow-primary/20 transition-all duration-500">
                                            <Sparkles className="text-primary w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg tracking-wide">Optimization Glow Up</h3>
                                            <p className="text-sm text-white/40 mt-1 leading-relaxed">Removes cached files and temporary assets to breathe new life into your Mac.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-6 group">
                                        <div className="w-14 h-14 rounded-2xl glass-frost flex items-center justify-center shrink-0 border border-white/10 shadow-lg group-hover:shadow-purple-400/20 transition-all duration-500">
                                            <Layers className="text-purple-400 w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg tracking-wide">Error Resolution</h3>
                                            <p className="text-sm text-white/40 mt-1 leading-relaxed">Purges broken logs and corrupted items that trigger unexpected behavior.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Graphic & CTA */}
                            <div className="flex flex-col items-center justify-center relative">
                                <div className="relative w-80 h-80 flex items-center justify-center">
                                    {/* Ambient Background Glow */}
                                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-[80px] animate-pulse" />
                                    <div className="relative w-72 h-72 rounded-[3rem] glass-frost flex items-center justify-center border border-white/10 shadow-2xl overflow-hidden group">
                                        <div className="absolute inset-0 bg-linear-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                        <Trash2 className="w-32 h-32 text-primary drop-shadow-[0_0_20px_rgba(236,72,153,0.4)]" strokeWidth={1} />
                                    </div>
                                </div>

                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="mt-12"
                                >
                                    <button
                                        onClick={handleScan}
                                        className="btn-scan"
                                    >
                                        Scan
                                    </button>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── Scanning state ── */}
                {viewState === 'scanning' && (
                    <motion.div
                        key="scanning"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full flex flex-col items-center justify-center relative z-10"
                    >
                        <div className="w-48 h-48 relative flex items-center justify-center mb-12">
                            {/* Radial Glows */}
                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-[60px] animate-pulse" />

                            {/* Spinning Ring */}
                            <div className="absolute inset-0 border-2 border-white/5 rounded-full" />
                            <motion.div
                                className="absolute inset-0 border-b-2 border-primary rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            />

                            <Trash2 className="text-white/30" size={64} strokeWidth={1} />
                        </div>
                        <h3 className="text-3xl font-black text-white uppercase tracking-widest shimmer-text">Scanning</h3>
                        <p className="text-white/30 font-mono mt-4 tracking-[0.4em] uppercase text-sm">Mapping System Architecture</p>
                    </motion.div>
                )}

                {/* ── Summary state ── */}
                {viewState === 'summary' && junkResult && (
                    <motion.div
                        key="summary"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="h-full flex flex-col items-center justify-center p-12 text-center relative z-10"
                    >
                        <button
                            onClick={() => setViewState('pre-scan')}
                            className="absolute top-8 left-8 flex items-center gap-2 text-white/30 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl"
                        >
                            <ArrowLeft size={16} /> <span className="text-xs font-bold uppercase tracking-wider">Back</span>
                        </button>

                        <div className="w-44 h-44 rounded-full bg-linear-to-br from-primary to-rose-600 flex items-center justify-center mb-10 shadow-2xl shadow-primary/30 ring-[12px] ring-white/5 relative group">
                            <div className="absolute inset-0 bg-primary/20 blur-2xl group-hover:blur-3xl transition-all duration-500" />
                            <Trash2 className="w-24 h-24 text-white relative z-10" strokeWidth={1} />
                        </div>

                        <h2 className="text-5xl font-black text-white mb-3 tracking-tighter shimmer-text">Scan Completed</h2>
                        <p className="text-xl text-white/40 mb-12 font-medium">Safe to remove files identified</p>

                        <div className="flex flex-col items-center glass-frost p-12 w-full max-w-lg border border-white/10 rounded-[3rem] shadow-2xl">
                            <div className="text-7xl font-black text-primary mb-3 font-mono tracking-tighter">
                                {formatBytes(selectedSize)}
                            </div>
                            <p className="text-white/30 mb-10 text-xs uppercase tracking-[0.3em] font-bold">Recommended for removal</p>

                            <button
                                onClick={() => setViewState('detail')}
                                className="text-sm font-bold text-primary/60 hover:text-primary transition-colors mb-10 flex items-center gap-2 group"
                            >
                                Review Storage Details
                                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>

                            <button
                                onClick={handleClean}
                                disabled={cleaning || selectedJunkItems.size === 0}
                                className="w-full py-5 rounded-3xl bg-primary hover:scale-[1.02] active:scale-[0.98] text-white font-black text-xl shadow-xl shadow-primary/30 transition-all disabled:opacity-30 uppercase tracking-widest"
                            >
                                {cleaning ? 'Purging Clutter...' : 'Clean Now'}
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* ── Detail View ── */}
                {viewState === 'detail' && (
                    <motion.div
                        key="detail"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        className="h-full flex flex-col bg-[#0f172a]/70 backdrop-blur-2xl relative z-20"
                    >
                        {/* Header */}
                        <div className="bg-white/5 border-b border-white/5 p-4 flex items-center justify-between shadow-sm z-30 backdrop-blur-sm">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setViewState('summary')}
                                    className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                                >
                                    <ArrowLeft size={20} />
                                </button>
                                <h2 className="text-lg font-semibold text-white">System Junk Details</h2>
                            </div>

                            <div className="flex items-center gap-3">
                                <select
                                    value={sortBy}
                                    onChange={e => setSortBy(e.target.value as any)}
                                    className="bg-white/5 border border-white/10 rounded-lg text-xs px-3 py-1.5 text-white/70 focus:outline-none"
                                >
                                    <option value="size">Sort by Size</option>
                                    <option value="name">Sort by Name</option>
                                </select>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                    <input
                                        type="text"
                                        placeholder="Search files..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-pink-500/50 w-48 transition-all focus:w-64"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Sidebar */}
                            <div className="w-72 bg-black/20 border-r border-white/5 overflow-y-auto">
                                <div className="p-4">
                                    <div className="text-xs font-bold text-white/30 uppercase tracking-wider mb-3 pl-2">Categories</div>
                                    <div className="space-y-1">
                                        {groupedCategories.map(cat => {
                                            const isCatActive = (selectedCategory || groupedCategories[0]?.name) === cat.name;
                                            const catSelected = cat.items.every(i => selectedJunkItems.has(i.path));

                                            return (
                                                <button
                                                    key={cat.name}
                                                    onClick={() => setSelectedCategory(cat.name)}
                                                    className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all ${isCatActive ? 'bg-pink-500/10 text-white' : 'text-white/50 hover:bg-white/5'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div
                                                            onClick={(e) => { e.stopPropagation(); toggleCategory(cat.name); }}
                                                            className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${catSelected ? 'bg-pink-500 border-pink-500' : 'border-white/20 hover:border-white/40'
                                                                }`}
                                                        >
                                                            {catSelected && <CheckCircle size={12} className="text-white" />}
                                                        </div>
                                                        <span className="truncate font-medium text-sm">{cat.name}</span>
                                                    </div>
                                                    <span className="text-xs bg-white/5 px-1.5 py-0.5 rounded text-white/40">{formatBytes(cat.totalSize)}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Main List */}
                            <div className="flex-1 bg-transparent flex flex-col">
                                {/* Category Header */}
                                <div className="p-6 border-b border-white/5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">{(selectedCategory || groupedCategories[0]?.name)}</h3>
                                            <p className="text-white/40 text-sm mt-1">
                                                Review individual files before deletion.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-pink-400">
                                                {/* Calculate selected size for this category */}
                                                {formatBytes(
                                                    (groupedCategories.find(c => c.name === (selectedCategory || groupedCategories[0]?.name))?.items || [])
                                                        .filter(i => selectedJunkItems.has(i.path))
                                                        .reduce((acc, i) => acc + i.size_bytes, 0)
                                                )}
                                            </span>
                                            <span className="text-white/30 text-sm">selected</span>
                                        </div>
                                    </div>
                                </div>

                                {/* List */}
                                <div className="flex-1 p-0">
                                    {/* Reuse filter logic */}
                                    {(() => {
                                        const activeCategory = selectedCategory || (groupedCategories[0]?.name ?? null);
                                        const activeCategoryItems = groupedCategories.find(c => c.name === activeCategory)?.items || [];
                                        const filteredItems = activeCategoryItems
                                            .filter(item => !searchQuery || item.path.toLowerCase().includes(searchQuery.toLowerCase()) || item.category_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                                            .sort((a, b) => sortBy === 'size' ? b.size_bytes - a.size_bytes : (a.path || '').localeCompare(b.path || ''));

                                        return (
                                            <Virtuoso
                                                style={{ height: '100%' }}
                                                data={filteredItems}
                                                itemContent={(_index, item) => (
                                                    <div
                                                        onClick={() => toggleJunkItem(item.path)}
                                                        className="flex items-center gap-4 px-6 py-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                                                    >
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${selectedJunkItems.has(item.path) ? 'bg-pink-500 border-pink-500' : 'border-white/20 group-hover:border-white/40'
                                                            }`}>
                                                            {selectedJunkItems.has(item.path) && <CheckCircle size={12} className="text-white" />}
                                                        </div>
                                                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-white/40">
                                                            <Trash2 size={18} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium text-white/90 truncate">{item.path.split('/').pop()}</div>
                                                            <div className="text-xs text-white/40 truncate font-mono">{item.path}</div>
                                                        </div>
                                                        <div className="text-sm text-white/60 font-mono">
                                                            {formatBytes(item.size_bytes)}
                                                        </div>
                                                    </div>
                                                )}
                                            />
                                        );
                                    })()}
                                </div>

                                {/* Floating Clean Button */}
                                <div className="p-6 border-t border-white/10 flex justify-center bg-black/10 backdrop-blur-md">
                                    <button
                                        onClick={handleClean}
                                        disabled={cleaning || selectedJunkItems.size === 0}
                                        className="px-8 py-3 rounded-full btn-premium bg-linear-to-r from-pink-500 to-rose-600 text-white font-bold transition-all flex items-center gap-2"
                                    >
                                        <span>Clean {formatBytes(selectedSize)}</span>
                                        {cleaning && <span className="animate-pulse">...</span>}
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
