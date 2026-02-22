import { useState, useEffect } from 'react';
import { useTauri } from '../hooks/useTauri';
import { formatBytes } from '../utils/formatBytes';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, File, ArrowLeft, Trash2, Loader2, Search, PieChart } from 'lucide-react';
import { ResponsiveTreeMap } from '@nivo/treemap';

interface FileNode {
    name: string;
    path: string;
    size: number;
    children?: FileNode[];
    is_dir: boolean;
    // Nivo needs a standardized color or strict hierarchy sometimes, but we can manage
}

// Custom theme for Nivo
const theme = {
    text: {
        fontSize: 11,
        fill: '#ffffff',
        fontFamily: 'Inter, sans-serif',
    },
    tooltip: {
        container: {
            background: '#1a1a1a',
            color: '#ffffff',
            fontSize: '12px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
        },
    },
};

export function SpaceLens() {
    const { call } = useTauri();
    const [viewState, setViewState] = useState<'landing' | 'scanning' | 'result'>('landing');
    const [rootNode, setRootNode] = useState<FileNode | null>(null);
    const [currentNode, setCurrentNode] = useState<FileNode | null>(null);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [history, setHistory] = useState<FileNode[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [scanDepth, setScanDepth] = useState(4);
    const [homePath, setHomePath] = useState<string | null>(null);

    useEffect(() => {
        call<string>('get_home_dir_command').then(setHomePath).catch(() => {});
    }, [call]);

    const handleScan = async (path?: string | null, depth: number = scanDepth, asRootScan: boolean = false) => {
        if (asRootScan) setViewState('scanning');
        try {
            if (asRootScan) await new Promise(r => setTimeout(r, 800));
            const result = await call<FileNode>('scan_space_lens_command', {
                path: path ?? null,
                depth,
            });
            if (asRootScan) {
                setRootNode(result);
                setCurrentNode(result);
                setViewState('result');
            } else {
                return result;
            }
        } catch (e) {
            console.error(e);
            if (asRootScan) setViewState('landing');
        }
    };

    const handleNavigate = async (node: any) => {
        // Nivo node structure is different from FileNode
        // node.data is the FileNode
        const fileNode = node.data as FileNode;

        if (!fileNode.is_dir) {
            setSelectedPath(fileNode.path);
            return;
        }

        // Drill down
        let nextNode = fileNode;

        // Fetch children if missing (lazy load)
        if (!fileNode.children || fileNode.children.length === 0) {
            const fetched = await handleScan(fileNode.path, undefined, false);
            if (fetched) nextNode = fetched;
        }

        if (currentNode) {
            setHistory(prev => [...prev, currentNode]);
        }
        setCurrentNode(nextNode);
        setSelectedPath(null);
    };

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

            // Refresh logic: naive update for speed
            if (currentNode && currentNode.children) {
                const newChildren = currentNode.children.filter(c => c.path !== selectedPath);
                const updatedNode = { ...currentNode, children: newChildren };
                setCurrentNode(updatedNode);

                // Also update backend for correctness
                const result = await call<FileNode>('scan_space_lens_command');
                setRootNode(result);
            }
            setSelectedPath(null);
        } catch (e) {
            console.error(e);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="h-full w-full bg-transparent text-white flex flex-col font-sans overflow-hidden relative">
            {/* Background Accents (Green/Teal for Space Lens) */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-teal-500/20 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            {viewState !== 'landing' && (
                <div className="h-14 flex items-center justify-between px-6 shrink-0 z-50 border-b border-white/5 relative">
                    <div className="flex items-center gap-4">
                        {history.length > 0 && (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="text-white/70 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer z-50"
                            >
                                <ArrowLeft size={18} /> Back
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
                                <p className="text-lg text-white/70 mb-6 leading-relaxed">
                                    Visualize your storage usage with an interactive heatmap. Spot large folders instantly.
                                </p>
                                <div className="mb-4">
                                    <span className="text-xs text-white/50 uppercase tracking-wider">Depth</span>
                                    <div className="flex gap-2 mt-1">
                                        {[3, 4, 5, 6].map(d => (
                                            <button
                                                key={d}
                                                onClick={() => setScanDepth(d)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${scanDepth === d ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleScan(null, scanDepth, true)}
                                        className="px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 transition-all font-semibold text-white shadow-lg shadow-emerald-900/40"
                                    >
                                        Home
                                    </button>
                                    <button
                                        onClick={() => handleScan('/Applications', scanDepth, true)}
                                        className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 font-medium text-white transition-all"
                                    >
                                        Applications
                                    </button>
                                    {homePath && (
                                        <button
                                            onClick={() => handleScan(`${homePath}/Library`, scanDepth, true)}
                                            className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 font-medium text-white transition-all"
                                        >
                                            Library
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-center">
                                <div className="w-64 h-64 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                                    <PieChart size={80} className="text-emerald-400" />
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
                            <div className="w-64 h-64 rounded-full bg-linear-to-br from-emerald-500 to-teal-700 animate-pulse shadow-2xl flex items-center justify-center">
                                <Search size={64} className="text-white/20" />
                                <div className="absolute inset-0 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-medium text-white mb-2">Analyzing Storage...</h2>
                        <p className="text-white/40 text-sm">Mapping file sizes...</p>
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
                        <div className="w-[350px] flex flex-col border-r border-white/5 bg-black/10 backdrop-blur-sm">
                            <div className="p-4 border-b border-white/5">
                                <h3 className="text-sm font-medium text-white">{currentNode.name || 'Root'}</h3>
                                <div className="text-xs text-white/50">{formatBytes(currentNode.size)} total</div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {currentNode.children?.sort((a, b) => b.size - a.size).map(child => (
                                    <div
                                        key={child.path}
                                        onClick={() => child.is_dir ? handleNavigate({ data: child }) : setSelectedPath(child.path)}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${selectedPath === child.path ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-white/50">
                                            {child.is_dir ? <Folder size={16} className="text-emerald-400" /> : <File size={16} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-white truncate">{child.name}</div>
                                            <div className="text-xs text-white/50">{formatBytes(child.size)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Bottom Removal Panel */}
                            {selectedPath && (
                                <div className="p-4 border-t border-white/5 bg-white/5 backdrop-blur-md">
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1 mr-4">
                                            <div className="text-xs text-white/40 mb-1">Select logic:</div>
                                            <div className="text-sm text-white truncate" title={selectedPath}>{selectedPath.split('/').pop()}</div>
                                        </div>
                                        <button
                                            onClick={handleRemove}
                                            disabled={isDeleting}
                                            className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-300 flex items-center justify-center transition-all"
                                        >
                                            {isDeleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Treemap Visualization */}
                        <div className="flex-1 bg-black/20 p-4 relative">
                            {currentNode.children && currentNode.children.length > 0 ? (
                                <ResponsiveTreeMap
                                    data={currentNode}
                                    identity="path"
                                    value="size"
                                    valueFormat={formatBytes}
                                    margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                                    labelSkipSize={12}
                                    labelTextColor={{
                                        from: 'color',
                                        modifiers: [['darker', 3]]
                                    }}
                                    parentLabelTextColor={{
                                        from: 'color',
                                        modifiers: [['darker', 2]]
                                    }}
                                    colors={[
                                        '#10b981', // emerald-500
                                        '#14b8a6', // teal-500
                                        '#06b6d4', // cyan-500
                                        '#0ea5e9', // sky-500
                                        '#3b82f6', // blue-500
                                        '#6366f1', // indigo-500
                                    ]}
                                    borderColor={{
                                        from: 'color',
                                        modifiers: [['darker', 0.1]]
                                    }}
                                    theme={theme}
                                    onClick={(node) => handleNavigate(node)}
                                    nodeOpacity={0.7}
                                    enableParentLabel={true}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-white/30">
                                    <Folder size={48} className="mb-4 opacity-50" />
                                    <span>Empty Folder</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
