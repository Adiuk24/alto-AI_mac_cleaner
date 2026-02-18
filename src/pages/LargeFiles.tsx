import { motion } from 'framer-motion';
import { HardDrive, File, Film, Music, Image as ImageIcon, Archive, CheckCircle, ChevronRight } from 'lucide-react';
import { useScanStore } from '../store/scanStore';
import { useTauri } from '../hooks/useTauri';
import { useState, useMemo } from 'react';
import { formatBytes } from '../utils/formatBytes';
import { playCompletionSound } from '../utils/sounds';

export function LargeFiles() {
    const { largeFilesResult, isScanningLargeFiles, startLargeFilesScan, finishLargeFilesScan } = useScanStore();
    const { call, loading } = useTauri();
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    const handleScan = async () => {
        startLargeFilesScan();
        const result = await call<any>('scan_large_files_command');
        if (result) {
            finishLargeFilesScan(result);
            const allPaths = new Set(result.items.map((i: any) => i.path as string));
            setSelectedItems(allPaths);
            playCompletionSound();
        }
    };

    const handleClean = async () => {
        const paths = Array.from(selectedItems);
        if (paths.length > 0) {
            await call('clean_items', { paths });
            handleScan();
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
            default: return File;
        }
    };

    // Pre-scan state
    if (!largeFilesResult && !isScanningLargeFiles) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center mb-8 shadow-2xl shadow-violet-500/30">
                    <HardDrive className="w-16 h-16 text-white/90" strokeWidth={1.5} />
                </div>

                <h2 className="text-3xl font-bold mb-3">Large & Old Files</h2>
                <p className="text-white/50 mb-10 max-w-md leading-relaxed">
                    Find files larger than 50MB taking up space in your Documents, Downloads, Movies, and Music folders.
                </p>

                <div className="space-y-4 mb-10 max-w-md w-full">
                    <div className="flex items-start gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                            <HardDrive size={18} className="text-violet-400" />
                        </div>
                        <div>
                            <p className="font-medium text-white/90">Reclaim disk space</p>
                            <p className="text-sm text-white/40">Identifies old downloads, media files, and forgotten archives.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                            <CheckCircle size={18} className="text-violet-400" />
                        </div>
                        <div>
                            <p className="font-medium text-white/90">Smart categorization</p>
                            <p className="text-sm text-white/40">Groups files by type — movies, music, archives, and more.</p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleScan}
                    disabled={loading}
                    className="w-16 h-16 rounded-full border-2 border-violet-400/50 bg-violet-500/10 hover:bg-violet-500/20 hover:border-violet-400 transition-all duration-300 flex items-center justify-center group shadow-lg shadow-violet-500/10 disabled:opacity-40"
                >
                    <span className="text-sm font-semibold text-violet-300 group-hover:text-violet-200">Scan</span>
                </button>
            </div>
        );
    }

    // Scanning state
    if (isScanningLargeFiles) {
        return (
            <div className="h-full flex flex-col items-center justify-center">
                <div className="w-20 h-20 border-4 border-violet-200/20 border-t-violet-500 rounded-full animate-spin mb-6" />
                <p className="text-lg font-medium text-white/80">Scanning for large files...</p>
            </div>
        );
    }

    // Results
    return (
        <div className="h-full flex flex-col">
            <header className="flex justify-between items-center px-6 py-4 border-b border-white/10">
                <div>
                    <h1 className="text-2xl font-bold">Large & Old Files</h1>
                    <p className="text-white/50 text-sm">
                        Found {largeFilesResult?.items.length} files · {formatBytes(selectedSize)} selected
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleScan}
                        disabled={loading}
                        className="px-4 py-2 text-sm rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Rescan
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto">
                {largeFilesResult?.items.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-white/40">
                        No large files found (&gt;50MB).
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {largeFilesResult?.items.map((item, idx) => {
                            const Icon = getIcon(item.category_name);
                            return (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: idx * 0.01 }}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer"
                                    onClick={() => toggleItem(item.path)}
                                >
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${selectedItems.has(item.path) ? 'bg-violet-500 border-violet-500' : 'border-white/20'
                                        }`}>
                                        {selectedItems.has(item.path) && <CheckCircle size={12} className="text-white" />}
                                    </div>
                                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                                        <Icon size={14} className="text-violet-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium truncate">{item.path.split('/').pop()}</p>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 shrink-0">{item.category_name}</span>
                                        </div>
                                        <p className="text-xs text-white/30 truncate">{item.path}</p>
                                    </div>
                                    <span className="text-xs text-white/40 font-mono shrink-0">{formatBytes(item.size_bytes)}</span>
                                    <ChevronRight size={14} className="text-white/20 shrink-0" />
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-center gap-4 p-4 border-t border-white/10 bg-black/20">
                <button
                    onClick={handleClean}
                    disabled={selectedItems.size === 0}
                    className="w-14 h-14 rounded-full border-2 border-violet-400/50 bg-violet-500/10 hover:bg-violet-500/20 hover:border-violet-400 transition-all duration-300 flex items-center justify-center group shadow-lg shadow-violet-500/10 disabled:opacity-40"
                >
                    <span className="text-xs font-semibold text-violet-300 group-hover:text-violet-200">Clean</span>
                </button>
                <span className="text-sm text-white/40">{formatBytes(selectedSize)}</span>
            </div>
        </div>
    );
}
