import { useState, useMemo } from 'react';
import { useTauri } from '../hooks/useTauri';
import { formatBytes } from '../utils/formatBytes';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, File, ChevronRight, ArrowLeft, Trash2, HardDrive, Loader2, Search } from 'lucide-react';

interface FileNode {
    name: string;
    path: string;
    size: number;
    children?: FileNode[];
    is_dir: boolean;
}

export function SpaceLens() {
    const { call } = useTauri();
    const [viewState, setViewState] = useState<'landing' | 'scanning' | 'result'>('landing');
    const [rootNode, setRootNode] = useState<FileNode | null>(null);
    const [currentNode, setCurrentNode] = useState<FileNode | null>(null);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [history, setHistory] = useState<FileNode[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleScan = async (path?: string) => {
        if (!path) setViewState('scanning');
        try {
            // Artificial delay for "Building storage map" effect only on initial
            if (!path) await new Promise(r => setTimeout(r, 2000));

            const result = await call<FileNode>('scan_space_lens_command', { path: path || null });

            if (!path) {
                setRootNode(result);
                setCurrentNode(result);
                setViewState('result');
            } else {
                return result;
            }
        } catch (e) {
            console.error(e);
            if (!path) setViewState('landing');
        }
    };

    const handleNavigate = async (node: FileNode) => {
        if (!node.is_dir) return; // Can't navigate into file

        // If node has no children (or empty from shallow scan), fetch it
        // Actually, our backend now returns depth 2. If we reach the edge, we need to fetch.
        // Simplified check: If children is defined but empty? Or just always fetch to be safe/deep?
        // Let's fetch if children is missing or empty and it is a dir
        let nextNode = node;

        if (!node.children || node.children.length === 0) {
            const fetched = await handleScan(node.path);
            if (fetched) nextNode = fetched;
        }

        if (currentNode) {
            setHistory(prev => [...prev, currentNode]);
        }
        setCurrentNode(nextNode);
        setSelectedPath(null); // Reset selection on nav
    };

    // Initial load? No, wait for user to click Scan
    // But we might want to auto-scan if already scanned before?
    // Keeping manual trigger as per design.

    const handleBack = () => {
        if (history.length === 0) return;
        const newHistory = [...history];
        const prev = newHistory.pop();
        setHistory(newHistory);
        setCurrentNode(prev || null);
        setSelectedPath(null);
    };

    const handleRemove = async () => {
        if (!selectedPath) return;
        setIsDeleting(true);
        try {
            await call('clean_items', { paths: [selectedPath] });
            // Refresh logic needs to happen here ideally, but for MVP we might just visually remove
            // or re-scan. Rescanning is safer but slower.
            // Let's fake update for speed:
            if (currentNode && currentNode.children) {
                const newChildren = currentNode.children.filter(c => c.path !== selectedPath);
                const updatedNode = { ...currentNode, children: newChildren };
                setCurrentNode(updatedNode);
                // We'd need to update rootNode recursively too for correctness, or just re-fetch.
                // Re-fetching is easier for correctness.
                const result = await call<FileNode>('scan_space_lens_command');
                setRootNode(result);
                // Try to find current path in new result? Simplification: go back to root or stay if possible
            }
            setSelectedPath(null);
        } catch (e) {
            console.error(e);
        } finally {
            setIsDeleting(false);
        }
    };

    // Bubble Chart Logic
    // We want to render circles packed inside a larger circle.
    // For MVP transparency, we'll use a simple layout logic:
    // render largest in center, others spiraling out or just random safe placement.
    // Actually, simple absolute positioning based on size might look cool and "organic".

    const renderBubbles = useMemo(() => {
        if (!currentNode || !currentNode.children) return null;

        const maxBubbles = 15;
        const bubbles = currentNode.children.slice(0, maxBubbles);
        const totalSize = currentNode.size;

        return bubbles.map((node, i) => {
            const pct = (node.size / totalSize) * 100;
            const sizePx = Math.max(60, Math.min(180, Math.log(pct + 1) * 50));

            // Simple visual scattering
            // We can distribute them in a grid or spiral.
            // Let's use a predefined grid for stability or pseudo-random seeded by index.
            const angle = i * 137.508; // Golden angle
            const radius = 30 * Math.sqrt(i);
            const x = radius * Math.cos(angle * Math.PI / 180);
            const y = radius * Math.sin(angle * Math.PI / 180);

            const isSelected = selectedPath === node.path;

            return (
                <motion.div
                    key={node.path}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, x, y }}
                    transition={{ delay: i * 0.05, type: "spring" }}
                    onClick={() => {
                        setSelectedPath(node.path);
                        // If double click or distinct action? Single click selects, click again enters?
                        // Let's let clicking the bubble select it. Double click to enter?
                    }}
                    onDoubleClick={() => handleNavigate(node)}
                    className={`absolute rounded-full flex flex-col items-center justify-center text-center p-2 cursor-pointer transition-all hover:z-50 shadow-lg ${isSelected
                        ? 'bg-white/20 border-2 border-white z-40'
                        : 'bg-white/10 border border-white/10 hover:bg-white/15'
                        }`}
                    style={{
                        width: sizePx,
                        height: sizePx,
                        backdropFilter: 'blur(8px)',
                        // Center of container is (0,0) implied by flex styling? No, we need absolute relative to center.
                        // We'll set left: 50%, top: 50% on container and use x/y translate.
                    }}
                >
                    <div className={`absolute inset-0 rounded-full transition-opacity opacity-30 ${pct > 20 ? 'bg-emerald-400' : pct > 5 ? 'bg-teal-400' : 'bg-cyan-600'
                        }`} />

                    <div className="z-10 relative overflow-hidden w-full px-1">
                        {node.is_dir ? <Folder size={sizePx / 3} className="mx-auto text-white/80 mb-1" /> : <File size={sizePx / 3} className="mx-auto text-white/80 mb-1" />}
                        {sizePx > 70 && (
                            <span className="block text-[10px] font-medium text-white truncate w-full">{node.name}</span>
                        )}
                        {sizePx > 90 && (
                            <span className="block text-[9px] text-white/60">{formatBytes(node.size)}</span>
                        )}
                    </div>
                </motion.div>
            );
        });
    }, [currentNode, selectedPath]);

    return (
        <div className="h-full w-full bg-transparent text-white flex flex-col font-sans overflow-hidden relative">
            {/* Background Accents (Green/Teal for Space Lens) */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-teal-500/20 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            {viewState !== 'landing' && (
                <div className="h-14 flex items-center justify-between px-6 shrink-0 z-20 border-b border-white/5">
                    <div className="flex items-center gap-4">
                        {history.length > 0 && (
                            <button onClick={handleBack} className="text-white/70 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
                                <ArrowLeft size={18} /> Prev
                            </button>
                        )}
                        <div className="flex items-center gap-2 text-white/50 text-sm">
                            <span className="opacity-50">Space Lens</span>
                            {currentNode && (
                                <>
                                    <span>/</span>
                                    <span className="text-white font-medium">{currentNode.name || 'Macintosh HD'}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium border border-white/5 transition-colors flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                            Assistant
                        </button>
                    </div>
                </div>
            )}

            {/* Views */}
            <AnimatePresence mode="wait">
                {viewState === 'landing' && (
                    <motion.div
                        key="landing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex items-center justify-center p-12 z-10"
                    >
                        <div className="max-w-4xl w-full grid grid-cols-2 gap-12 items-center">
                            <div>
                                <h1 className="text-4xl font-bold mb-4 text-white">Space Lens</h1>
                                <p className="text-lg text-white/70 mb-8 leading-relaxed">
                                    Get a visual size comparison of your folders and files for quick tidying up.
                                </p>

                                <div className="space-y-6 mb-12">
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center shrink-0">
                                            <div className="w-6 h-6 rounded-full border-2 border-emerald-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white">Instant size overview</h3>
                                            <p className="text-sm text-white/50">Browse your storage while seeing what's taking up the most space.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center shrink-0">
                                            <HardDrive size={24} className="text-emerald-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white">Quick decision-making</h3>
                                            <p className="text-sm text-white/50">Waste no time checking size of what you are removing.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/10 rounded-xl p-4 flex items-center justify-between border border-white/10 mb-8">
                                    <div className="flex items-center gap-3">
                                        <HardDrive size={24} className="text-white/60" />
                                        <div>
                                            <div className="font-medium text-sm">Macintosh HD</div>
                                            <div className="text-xs text-white/40">406.94 GB Used</div>
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-32 bg-black/20 rounded-full overflow-hidden">
                                        <div className="h-full w-[70%] bg-amber-400 rounded-full" />
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleScan()}
                                    className="px-8 py-3 rounded-full bg-white/10 border-2 border-white/20 hover:bg-white/20 hover:border-white/40 transition-all font-semibold text-white shadow-lg shadow-black/20"
                                >
                                    Scan
                                </button>
                            </div>

                            {/* Planet Graphic for Landing */}
                            <div className="relative flex items-center justify-center">
                                <div className="w-80 h-80 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 shadow-2xl flex items-center justify-center relative overflow-hidden">
                                    {/* Stylized Planet Rings/Glow */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-50" />
                                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/20 blur-3xl rounded-full" />
                                    <div className="absolute left-10 bottom-10 w-20 h-20 bg-emerald-300/30 blur-2xl rounded-full" />

                                    {/* Orbit Ring visual */}
                                    <div className="absolute w-[120%] h-[120%] border-[20px] border-white/10 rounded-full rotate-45 scale-y-50 blur-sm brightness-150" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {viewState === 'scanning' && (
                    <motion.div
                        key="scanning"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col items-center justify-center z-10"
                    >
                        <div className="mb-8 relative">
                            <div className="w-64 h-64 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 animate-pulse shadow-2xl flex items-center justify-center">
                                <Search size={64} className="text-white/20" />
                                {/* Scanning Ring */}
                                <div className="absolute inset-0 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-medium text-white mb-2">Building your storage map...</h2>
                        <p className="text-white/40 text-sm">/Users/adi/...</p>

                        <button
                            onClick={() => setViewState('landing')}
                            className="mt-12 w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors group"
                        >
                            <span className="text-xs font-medium text-white/60 group-hover:text-white">Stop</span>
                        </button>
                    </motion.div>
                )}

                {viewState === 'result' && rootNode && currentNode && (
                    <motion.div
                        key="result"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex-1 flex overflow-hidden z-10"
                    >
                        {/* Sidebar List */}
                        <div className="w-[400px] flex flex-col border-r border-white/5 bg-black/10 backdrop-blur-sm">
                            <div className="flex-1 overflow-y-auto p-4 space-y-1">
                                <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4 px-2">
                                    {currentNode.path === rootNode.path ? 'Macintosh HD' : currentNode.name}
                                </h3>
                                {currentNode.children?.map(child => {
                                    const pct = (child.size / currentNode.size) * 100;
                                    const isSelected = selectedPath === child.path;

                                    return (
                                        <div
                                            key={child.path}
                                            onClick={() => setSelectedPath(child.path)}
                                            onDoubleClick={() => handleNavigate(child)}
                                            className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                                                }`}
                                        >
                                            {/* Selection Indicator */}
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-emerald-400 bg-emerald-400/20' : 'border-white/20 group-hover:border-white/40'
                                                }`}>
                                                {isSelected && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                                            </div>

                                            {/* Icon */}
                                            <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-white/50 shrink-0">
                                                {child.is_dir ? <Folder size={16} /> : <File size={16} />}
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0 z-10">
                                                <div className="flex justify-between items-baseline mb-0.5">
                                                    <span className="text-sm font-medium truncate text-white/90">{child.name}</span>
                                                    <span className="text-xs text-white/50">{formatBytes(child.size)}</span>
                                                </div>
                                                {/* Bar */}
                                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500/50 rounded-full"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {child.is_dir && (
                                                <button onClick={(e) => { e.stopPropagation(); handleNavigate(child); }} className="p-1 hover:bg-white/10 rounded text-white/30 hover:text-white">
                                                    <ChevronRight size={14} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Bottom Removal Panel */}
                            <div className="p-4 border-t border-white/5 bg-white/5 backdrop-blur-md">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm text-white/50">
                                        {selectedPath ? formatBytes(currentNode.children?.find(c => c.path === selectedPath)?.size || 0) : '0 B'} selected
                                    </span>
                                    {selectedPath && (
                                        <button
                                            onClick={handleRemove}
                                            disabled={isDeleting}
                                            className="w-12 h-12 rounded-full bg-white/10 hover:bg-red-500/20 text-white/50 hover:text-red-400 flex items-center justify-center transition-all shadow-inner border border-white/5"
                                        >
                                            {isDeleting ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                                        </button>
                                    )}
                                </div>
                                {selectedPath && (
                                    <div className="text-xs text-white/30 text-center truncate px-2">
                                        {selectedPath}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Visual Chart Area */}
                        <div className="flex-1 relative flex items-center justify-center bg-black/20">
                            {/* Central Circle Container */}
                            <div className="relative w-[500px] h-[500px] rounded-full border-4 border-white/5 bg-white/5 backdrop-blur-sm flex items-center justify-center shadow-2xl">
                                <div className="absolute inset-0 rounded-full bg-emerald-500/5 animate-pulse" />
                                <AnimatePresence>
                                    {renderBubbles}
                                </AnimatePresence>

                                <div className="text-center z-0 pointer-events-none">
                                    <div className="text-2xl font-bold text-white/20">{currentNode.name || 'Root'}</div>
                                    <div className="text-lg text-white/10">{formatBytes(currentNode.size)}</div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
