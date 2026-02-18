import { Trash2, AlertCircle, CheckCircle, ArrowLeft, Search, ChevronRight } from 'lucide-react';
import { useScanStore } from '../store/scanStore';
import { useTauri } from '../hooks/useTauri';
import { useState, useMemo } from 'react';
import { Button } from '../components/Button';
import { formatBytes } from '../utils/formatBytes';
import { playCompletionSound } from '../utils/sounds';
import { Virtuoso } from 'react-virtuoso';

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
    const { call, loading } = useTauri();
    const [cleaning, setCleaning] = useState(false);
    const [viewState, setViewState] = useState<ViewState>(junkResult ? 'summary' : 'pre-scan');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'size' | 'name'>('size');

    const handleScan = async () => {
        setViewState('scanning');
        startJunkScan();
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

        // If all selected, deselect all. Otherwise, select all.
        // We can't batch updates easily with just toggle, so we might need a batch action or just standard set
        // Actually, let's use the setAllJunkItems to update efficiently if we construct the new set here.

        const next = new Set(selectedJunkItems);
        categoryPaths.forEach(p => {
            if (allSelected) next.delete(p);
            else next.add(p);
        });
        setAllJunkItems(next);
    };

    // ── Pre-scan state ──
    if (viewState === 'pre-scan') {
        return (
            <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center mb-8 shadow-2xl shadow-purple-500/30">
                    <Trash2 className="w-16 h-16 text-white/90" strokeWidth={1.5} />
                </div>

                <h2 className="text-3xl font-bold mb-3">System Junk</h2>
                <p className="text-white/50 mb-10 max-w-md leading-relaxed">
                    Clean your system to achieve maximum performance and reclaim free space.
                </p>

                <div className="space-y-4 mb-10 max-w-md w-full">
                    <div className="flex items-start gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0">
                            <Trash2 size={18} className="text-pink-400" />
                        </div>
                        <div>
                            <p className="font-medium text-white/90">Optimizes your system</p>
                            <p className="text-sm text-white/40">Removes temporary files to free up space and smoothen performance.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0">
                            <CheckCircle size={18} className="text-pink-400" />
                        </div>
                        <div>
                            <p className="font-medium text-white/90">Resolves all kinds of errors</p>
                            <p className="text-sm text-white/40">Gets rid of broken items that may cause wrong application behavior.</p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleScan}
                    disabled={loading}
                    className="w-16 h-16 rounded-full border-2 border-purple-400/50 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-400 transition-all duration-300 flex items-center justify-center group shadow-lg shadow-purple-500/10 disabled:opacity-40"
                >
                    <span className="text-sm font-semibold text-purple-300 group-hover:text-purple-200">Scan</span>
                </button>
            </div>
        );
    }

    // ── Scanning state ──
    if (viewState === 'scanning') {
        return (
            <div className="h-full flex flex-col items-center justify-center">
                <div className="w-20 h-20 border-4 border-pink-200/20 border-t-pink-500 rounded-full animate-spin mb-6" />
                <p className="text-lg font-medium text-white/80">Scanning for junk...</p>
            </div>
        );
    }

    // ── Summary state ──
    if (viewState === 'summary' && junkResult) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                <button
                    onClick={() => setViewState('pre-scan')}
                    className="absolute top-6 left-6 flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
                >
                    <ArrowLeft size={16} /> Start Over
                </button>

                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center mb-8 shadow-2xl shadow-purple-500/30">
                    <Trash2 className="w-14 h-14 text-white/90" strokeWidth={1.5} />
                </div>

                <h2 className="text-3xl font-bold mb-4">Scan completed</h2>

                <p className="text-5xl font-bold text-pink-400 mb-2">
                    {formatBytes(selectedSize)}
                </p>
                <p className="text-white/40 mb-6">Smart-selected</p>

                <div className="text-left mb-8 max-w-sm w-full">
                    <p className="text-white/50 text-sm mb-3 px-1">Including:</p>
                    <ul className="space-y-1 text-sm text-white/70 px-1">
                        {groupedCategories.slice(0, 5).map(cat => (
                            <li key={cat.name} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                                {cat.name}
                            </li>
                        ))}
                    </ul>
                </div>

                <Button
                    onClick={() => setViewState('detail')}
                    variant="secondary"
                    size="sm"
                    className="mb-8 text-pink-300 border-pink-500/30 hover:bg-pink-500/10"
                >
                    Review Details
                </Button>

                <p className="text-white/30 text-sm mb-4">{formatBytes(junkResult.total_size_bytes)} found in total</p>

                <button
                    onClick={handleClean}
                    disabled={cleaning || selectedJunkItems.size === 0}
                    className="w-16 h-16 rounded-full border-2 border-purple-400/50 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-400 transition-all duration-300 flex items-center justify-center group shadow-lg shadow-purple-500/10 disabled:opacity-40"
                >
                    <span className="text-sm font-semibold text-purple-300 group-hover:text-purple-200">
                        {cleaning ? '...' : 'Clean'}
                    </span>
                </button>
            </div>
        );
    }

    // ── Detail view ── (two-panel)
    const activeCategory = selectedCategory || (groupedCategories[0]?.name ?? null);
    const activeCategoryItems = groupedCategories.find(c => c.name === activeCategory)?.items || [];

    // Filter and sort items
    const filteredItems = activeCategoryItems
        .filter(item => !searchQuery || item.path.toLowerCase().includes(searchQuery.toLowerCase()) || item.category_name?.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => sortBy === 'size' ? b.size_bytes - a.size_bytes : (a.path || '').localeCompare(b.path || ''));

    return (
        <div className="h-full flex flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <button
                    onClick={() => setViewState('summary')}
                    className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
                >
                    <ArrowLeft size={16} /> Back
                </button>
                <span className="text-sm font-medium text-white/60">System Junk</span>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (selectedJunkItems.size === junkResult!.items.length) {
                                setAllJunkItems(new Set());
                            } else {
                                setAllJunkItems(new Set(junkResult!.items.map(i => i.path)));
                            }
                        }}
                        className="text-xs text-pink-300 hover:text-pink-200 transition-colors"
                    >
                        {selectedJunkItems.size === junkResult!.items.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as any)}
                        className="text-xs bg-transparent text-white/50 border border-white/10 rounded-md px-2 py-1 focus:outline-none"
                    >
                        <option value="size">Sort by Size</option>
                        <option value="name">Sort by Name</option>
                    </select>
                    <div className="relative">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-black/30 border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 w-40"
                        />
                    </div>
                </div>
            </div>

            {/* Two-panel layout */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left panel - Categories */}
                <div className="w-72 border-r border-white/10 overflow-y-auto bg-black/10">
                    {groupedCategories.map(cat => {
                        const isCatActive = cat.name === activeCategory;
                        const catSelected = cat.items.every(i => selectedJunkItems.has(i.path));
                        const catPartial = cat.items.some(i => selectedJunkItems.has(i.path)) && !catSelected;

                        return (
                            <div
                                key={cat.name}
                                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-white/5 ${isCatActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                onClick={() => setSelectedCategory(cat.name)}
                            >
                                <div
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${catSelected ? 'bg-pink-500 border-pink-500' : catPartial ? 'border-pink-400' : 'border-white/20'
                                        }`}
                                    onClick={(e) => { e.stopPropagation(); toggleCategory(cat.name); }}
                                >
                                    {catSelected && <CheckCircle size={12} className="text-white" />}
                                    {catPartial && <div className="w-2 h-2 bg-pink-400 rounded-sm" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{cat.name}</p>
                                </div>
                                <span className="text-xs text-white/40 font-mono shrink-0">{formatBytes(cat.totalSize)}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Right panel - Items */}
                <div className="flex-1 overflow-y-auto">
                    {activeCategory && (
                        <div className="p-4 border-b border-white/10 bg-white/5">
                            <h3 className="text-lg font-semibold">{activeCategory}</h3>
                            <p className="text-xs text-white/40 mt-1">{filteredItems.length} items · Sort by {sortBy}</p>
                        </div>
                    )}
                    <div className="flex-1 h-full">
                        <Virtuoso
                            style={{ height: '100%' }}
                            data={filteredItems}
                            itemContent={(_index: number, item: any) => (
                                <div
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5"
                                    onClick={() => toggleJunkItem(item.path)}
                                >
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${selectedJunkItems.has(item.path) ? 'bg-pink-500 border-pink-500' : 'border-white/20'
                                        }`}>
                                        {selectedJunkItems.has(item.path) && <CheckCircle size={12} className="text-white" />}
                                    </div>
                                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                                        <Trash2 size={14} className="text-purple-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{item.path.split('/').pop()}</p>
                                        <p className="text-xs text-white/30 truncate">{item.path}</p>
                                    </div>
                                    <span className="text-xs text-white/40 font-mono shrink-0">{formatBytes(item.size_bytes)}</span>
                                    <ChevronRight size={14} className="text-white/20 shrink-0" />
                                </div>
                            )}
                        />
                    </div>
                </div>
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-center gap-4 p-4 border-t border-white/10 bg-black/20">
                <button
                    onClick={handleClean}
                    disabled={cleaning || selectedJunkItems.size === 0}
                    className="w-14 h-14 rounded-full border-2 border-purple-400/50 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-400 transition-all duration-300 flex items-center justify-center group shadow-lg shadow-purple-500/10 disabled:opacity-40"
                >
                    <span className="text-xs font-semibold text-purple-300 group-hover:text-purple-200">
                        {cleaning ? '...' : 'Clean'}
                    </span>
                </button>
                <span className="text-sm text-white/40">{formatBytes(selectedSize)}</span>
            </div>

            {junkResult?.errors.length ? (
                <div className="mx-6 mb-4 p-3 bg-amber-900/20 text-amber-400 rounded-lg text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold mb-1">Some errors occurred:</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                            {junkResult.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                            {junkResult.errors.length > 3 && <li>+ {junkResult.errors.length - 3} more</li>}
                        </ul>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
