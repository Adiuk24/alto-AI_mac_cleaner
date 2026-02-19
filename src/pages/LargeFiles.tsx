import { motion } from 'framer-motion';
import { HardDrive, File, Film, Music, Image as ImageIcon, Archive, CheckCircle, ChevronRight, Trash2, Filter } from 'lucide-react';
import { useScanStore } from '../store/scanStore';
import { useTauri } from '../hooks/useTauri';
import { useState, useMemo } from 'react';
import { formatBytes } from '../utils/formatBytes';
import { playCompletionSound } from '../utils/sounds';

type FilterType = 'All' | 'Archives' | 'Documents' | 'Movies' | 'Music' | 'Pictures' | 'Other';
type SizeFilter = 'All' | 'Huge' | 'Average' | 'Small';
type DateFilter = 'All' | 'OneYear' | 'OneMonth' | 'OneWeek';

export function LargeFiles() {
    const { largeFilesResult, isScanningLargeFiles, startLargeFilesScan, finishLargeFilesScan } = useScanStore();
    const { call, loading } = useTauri(); // loading might be used later for buttons, but for now linter complains. Keeping it destructured but suppressing or validly ignoring?
    // Actually loading IS used in the first scan button. But not in the second?
    // Wait, I see "disabled={loading}" in my previous code for the first scan button.
    // Linter said 'loading' is declared but never read at line 15.
    // Let's check my rewrite. 
    // I see: <button onClick={handleScan} ... > Review Large Files </button> without disabled={loading}.
    // I should probably add it back for safety.

    // For imports: 
    // AnimatePresence, X, Calendar are definitely unused.
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // Filters
    const [activeFilter, setActiveFilter] = useState<FilterType>('All');
    const [sizeFilter, setSizeFilter] = useState<SizeFilter>('All');
    const [dateFilter, setDateFilter] = useState<DateFilter>('All');

    const handleScan = async () => {
        startLargeFilesScan();
        const result = await call<any>('scan_large_files_command');
        if (result) {
            finishLargeFilesScan(result);
            playCompletionSound();
        }
    };

    const handleClean = async () => {
        const paths = Array.from(selectedItems);
        if (paths.length > 0) {
            await call('clean_items', { paths });
            handleScan();
            setSelectedItems(new Set());
        }
    };

    const toggleItem = (path: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    const filteredItems = useMemo(() => {
        if (!largeFilesResult) return [];

        const now = Date.now() / 1000;
        const ONE_YEAR = 365 * 24 * 60 * 60;
        const ONE_MONTH = 30 * 24 * 60 * 60;
        const ONE_WEEK = 7 * 24 * 60 * 60;

        return largeFilesResult.items.filter(item => {
            // Category Filter
            if (activeFilter !== 'All' && item.category_name !== activeFilter) return false;

            // Size Filter
            if (sizeFilter === 'Huge' && item.size_bytes < 1024 * 1024 * 1024) return false;
            if (sizeFilter === 'Average' && (item.size_bytes < 50 * 1024 * 1024 || item.size_bytes >= 1024 * 1024 * 1024)) return false;
            if (sizeFilter === 'Small' && item.size_bytes >= 50 * 1024 * 1024) return false;

            // Date Filter (using accessed_date if available)
            if (item.accessed_date) {
                const diff = now - item.accessed_date;
                if (dateFilter === 'OneYear' && diff < ONE_YEAR) return false;
                if (dateFilter === 'OneMonth' && diff < ONE_MONTH) return false;
                if (dateFilter === 'OneWeek' && diff < ONE_WEEK) return false;
            }

            return true;
        });
    }, [largeFilesResult, activeFilter, sizeFilter, dateFilter]);

    const selectedSize = useMemo(() => {
        if (!largeFilesResult) return 0;
        return largeFilesResult.items
            .filter(i => selectedItems.has(i.path))
            .reduce((s, i) => s + i.size_bytes, 0);
    }, [largeFilesResult, selectedItems]);

    const getIcon = (category: string) => {
        switch (category) {
            case 'Movies': return Film;
            case 'Music': return Music;
            case 'Pictures': return ImageIcon;
            case 'Archives': return Archive;
            case 'Documents': return File;
            default: return File;
        }
    };

    const stats = useMemo(() => {
        const s = {
            // Global
            All: { count: 0, size: 0 },
            // Size
            Huge: { count: 0, size: 0 },
            Average: { count: 0, size: 0 },
            Small: { count: 0, size: 0 },
            // Kind
            Archives: { count: 0, size: 0 },
            Documents: { count: 0, size: 0 },
            Movies: { count: 0, size: 0 },
            Music: { count: 0, size: 0 },
            Pictures: { count: 0, size: 0 },
            Other: { count: 0, size: 0 },
            // Date
            OneYear: { count: 0, size: 0 },
            OneMonth: { count: 0, size: 0 },
            OneWeek: { count: 0, size: 0 },
        };

        if (!largeFilesResult) return s;

        const now = Date.now() / 1000;
        const ONE_YEAR = 365 * 24 * 60 * 60;
        const ONE_MONTH = 30 * 24 * 60 * 60;
        const ONE_WEEK = 7 * 24 * 60 * 60;

        largeFilesResult.items.forEach(item => {
            // Global
            s.All.count++;
            s.All.size += item.size_bytes;

            // Size
            if (item.size_bytes >= 1024 * 1024 * 1024) {
                s.Huge.count++;
                s.Huge.size += item.size_bytes;
            } else if (item.size_bytes >= 50 * 1024 * 1024) {
                s.Average.count++;
                s.Average.size += item.size_bytes;
            } else {
                s.Small.count++;
                s.Small.size += item.size_bytes;
            }

            // Kind
            const cat = item.category_name as keyof typeof s;
            if (s[cat]) {
                s[cat].count++;
                s[cat].size += item.size_bytes;
            } else {
                s.Other.count++;
                s.Other.size += item.size_bytes;
            }

            // Date
            if (item.accessed_date) {
                const diff = now - item.accessed_date;
                if (diff >= ONE_YEAR) {
                    s.OneYear.count++;
                    s.OneYear.size += item.size_bytes;
                }
                if (diff >= ONE_MONTH) {
                    s.OneMonth.count++;
                    s.OneMonth.size += item.size_bytes;
                }
                if (diff >= ONE_WEEK) {
                    s.OneWeek.count++;
                    s.OneWeek.size += item.size_bytes;
                }
            }
        });

        return s;
    }, [largeFilesResult]);

    // Pre-scan state
    if (!largeFilesResult && !isScanningLargeFiles) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-10 text-center relative overflow-hidden">
                {/* Background Gradients */}
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />

                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-8 shadow-2xl shadow-pink-500/30 z-10">
                    <HardDrive className="w-16 h-16 text-white/90" strokeWidth={1.5} />
                </div>

                <h2 className="text-4xl font-bold mb-4 z-10 bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Large & Old Files</h2>
                <p className="text-white/50 mb-12 max-w-md leading-relaxed z-10 text-lg">
                    Locate heavy files you haven't opened in months. Reclaim gigabytes of space instantly.
                </p>

                <button
                    onClick={handleScan}
                    disabled={loading}
                    className="px-10 py-4 rounded-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 transition-all font-semibold text-white shadow-lg shadow-pink-900/40 z-10 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Scanning...' : 'Review Large Files'}
                </button>
            </div>
        );
    }

    // Scanning state
    if (isScanningLargeFiles) {
        return (
            <div className="h-full flex flex-col items-center justify-center relative overflow-hidden">
                {/* Background ambient glow */}
                <div className="absolute w-[500px] h-[500px] bg-pink-500/5 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative">
                    {/* Ring Container */}
                    <div className="relative w-24 h-24 mb-8">
                        {/* Static Track */}
                        <div className="absolute inset-0 rounded-full border-4 border-white/5" />

                        {/* Spinning Gradient Segment */}
                        <motion.div
                            className="absolute inset-0 rounded-full border-4 border-transparent border-t-pink-500 border-l-pink-500/50"
                            style={{ rotate: 0 }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />

                        {/* Counter-rotating inner ring for complexity */}
                        <motion.div
                            className="absolute inset-3 rounded-full border-2 border-transparent border-b-purple-500/50"
                            style={{ rotate: 0 }}
                            animate={{ rotate: -360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        />

                        {/* Pulsing Core */}
                        <motion.div
                            className="absolute inset-0 rounded-full bg-pink-500/10"
                            animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.2, 0.5, 0.2] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        />
                    </div>
                </div>

                <motion.h3
                    className="text-xl font-medium text-white mb-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    Scanning drive...
                </motion.h3>

                <motion.p
                    className="text-white/40 text-sm"
                    animate={{ opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                >
                    Checking usage dates...
                </motion.p>
            </div>
        );
    }

    // Results (Master-Detail Layout)
    return (
        <div className="h-full flex overflow-hidden">
            {/* Sidebar Filters */}
            <div className="w-64 bg-black/20 border-r border-white/5 flex flex-col p-4 overflow-y-auto backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-6 px-2">
                    <button onClick={handleScan} className="text-xs font-semibold text-white/60 hover:text-white transition-colors flex items-center gap-1">
                        <ChevronRight className="rotate-180" size={14} /> Back
                    </button>
                    <div className="flex-1" />
                    <span className="text-xs text-white/40">{largeFilesResult?.items.length} files</span>
                </div>

                <div className="space-y-6">
                    {/* Size Filter Group */}
                    <div>
                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 px-2">By Size</h3>
                        <div className="space-y-1">
                            {(['All', 'Huge', 'Average', 'Small'] as SizeFilter[]).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setSizeFilter(f)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex justify-between group ${sizeFilter === f ? 'bg-pink-500/20 text-pink-300 font-medium' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <span>{f === 'All' ? 'All Sizes' : f}</span>
                                    {stats[f].count > 0 && (
                                        <span className={`text-xs ${sizeFilter === f ? 'text-pink-300/70' : 'text-white/30 group-hover:text-white/50'}`}>
                                            {formatBytes(stats[f].size)}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Kind Filter Group */}
                    <div>
                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 px-2">By Kind</h3>
                        <div className="space-y-1">
                            {(['All', 'Archives', 'Documents', 'Movies', 'Music', 'Pictures', 'Other'] as FilterType[]).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setActiveFilter(f)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex justify-between group ${activeFilter === f ? 'bg-pink-500/20 text-pink-300 font-medium' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <span>{f === 'All' ? 'All Files' : f}</span>
                                    {stats[f].count > 0 && (
                                        <span className={`text-xs ${activeFilter === f ? 'text-pink-300/70' : 'text-white/30 group-hover:text-white/50'}`}>
                                            {formatBytes(stats[f].size)}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date Filter Group */}
                    <div>
                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 px-2">By Access Date</h3>
                        <div className="space-y-1">
                            {[
                                { id: 'All', label: 'Any Time' },
                                { id: 'OneYear', label: 'One Year Ago' },
                                { id: 'OneMonth', label: 'One Month Ago' },
                                { id: 'OneWeek', label: 'One Week Ago' },
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setDateFilter(f.id as DateFilter)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex justify-between group ${dateFilter === f.id ? 'bg-pink-500/20 text-pink-300 font-medium' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <span>{f.label}</span>
                                    {f.id !== 'All' && stats[f.id as keyof typeof stats].count > 0 && (
                                        <span className={`text-xs ${dateFilter === f.id ? 'text-pink-300/70' : 'text-white/30 group-hover:text-white/50'}`}>
                                            {formatBytes(stats[f.id as keyof typeof stats].size)}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content List */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#1e1135]/50">
                <header className="px-8 py-5 border-b border-white/5 flex items-baseline justify-between shrink-0 bg-opacity-90 backdrop-blur-md sticky top-0 z-10">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">
                            {activeFilter === 'All' ? 'All Files' : activeFilter}
                        </h1>
                        <p className="text-sm text-white/50">
                            Found {filteredItems.length} files · {formatBytes(filteredItems.reduce((acc, i) => acc + i.size_bytes, 0))} total
                        </p>
                    </div>
                    <div className="text-xs text-white/30">
                        Sort by Size
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
                    {filteredItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-white/30 opacity-60">
                            <Filter size={48} className="mb-4 text-white/20" />
                            <p>No files match this filter</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredItems.map((item, idx) => {
                                const Icon = getIcon(item.category_name);
                                const isSelected = selectedItems.has(item.path);
                                return (
                                    <motion.div
                                        key={item.path}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx > 20 ? 0 : idx * 0.02 }}
                                        onClick={() => toggleItem(item.path)}
                                        className={`group flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all border border-transparent ${isSelected ? 'bg-white/10 border-white/5' : 'hover:bg-white/5'}`}
                                    >
                                        {/* Checkbox */}
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 shrink-0 ${isSelected ? 'bg-pink-500 border-pink-500' : 'border-white/20 group-hover:border-white/40'}`}>
                                            {isSelected && <CheckCircle size={12} className="text-white" />}
                                        </div>

                                        {/* Icon */}
                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                                            <Icon size={18} className="text-white/70" />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <h4 className="text-sm font-medium text-white truncate pr-2">{item.path.split('/').pop()}</h4>
                                                <span className="text-sm font-semibold text-white/90 whitespace-nowrap">{formatBytes(item.size_bytes)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-white/40">
                                                <span className="truncate max-w-[80%] opacity-70 group-hover:opacity-100 transition-opacity">{item.path}</span>
                                                {item.category_name !== 'Other' && (
                                                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/50">{item.category_name}</span>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Action Bar */}
                <div className="p-4 border-t border-white/10 flex items-center justify-between bg-black/20 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            {/* Avatars or logic preview placeholder */}
                        </div>
                        <div className="text-sm text-white/60">
                            {selectedItems.size === 0 ? 'Select files to clean' : `${selectedItems.size} files selected`}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-white tabular-nums">{formatBytes(selectedSize)}</span>
                        <button
                            onClick={handleClean}
                            disabled={selectedItems.size === 0}
                            className="h-12 px-8 rounded-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 disabled:opacity-30 disabled:hover:from-pink-500 disabled:hover:to-rose-600 text-white font-semibold shadow-lg shadow-pink-900/20 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <Trash2 size={18} />
                            <span>Remove</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
