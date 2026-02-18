import { useEffect, useState } from 'react';
import { useTauri } from '../hooks/useTauri';
import type { FileNode } from '../types';
import { formatBytes } from '../utils/formatBytes';
import { motion } from 'framer-motion';

// Recursive component to render file nodes as nested properties
// For a true "Space Lens" look, we might want a Voronoi or Treemap.
// For MVP without external heavy libraries, let's build a simple interactive list/bar visualization.
// Or better, a "Bubble" view using CSS circles.

const BubbleNode = ({ node, totalSize, index }: { node: FileNode; totalSize: number; index: number }) => {
    // Calculate relative size
    const percentage = (node.size / totalSize) * 100;
    // Logarithmic scale for better visualization of small files among large ones
    const sizePx = Math.max(80, Math.min(240, Math.log(percentage + 1) * 60));

    // Generate random initial position for "floating" feel
    const randomX = Math.random() * 20 - 10;
    const randomY = Math.random() * 20 - 10;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{
                opacity: 1,
                scale: 1,
                x: [0, randomX, 0],
                y: [0, randomY, 0],
            }}
            transition={{
                duration: 5 + Math.random() * 5,
                repeat: Infinity,
                repeatType: "reverse",
                delay: index * 0.1,
                ease: "easeInOut"
            }}
            className="rounded-full flex flex-col items-center justify-center text-center p-4 border border-white/10 bg-white/5 backdrop-blur-md relative overflow-hidden group cursor-pointer hover:bg-white/10 hover:border-white/20 transition-colors hover:z-50 shadow-lg"
            style={{ width: sizePx, height: sizePx }}
            whileHover={{ scale: 1.15, transition: { duration: 0.2 } }}
            title={`${node.name} (${formatBytes(node.size)})`}
        >
            <div className={`absolute inset-0 bg-gradient-to-br opacity-20 group-hover:opacity-40 transition-opacity ${percentage > 10 ? 'from-purple-500 to-pink-500' :
                    percentage > 5 ? 'from-blue-500 to-cyan-500' : 'from-gray-500 to-slate-500'
                }`} />

            <div className="z-10 flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-white truncate max-w-[90%] drop-shadow-md">{node.name}</span>
                <span className="text-[10px] text-white/70 font-medium">{formatBytes(node.size)}</span>
                {percentage > 5 && (
                    <span className="text-[9px] text-white/40">{percentage.toFixed(1)}%</span>
                )}
            </div>
        </motion.div>
    );
};

export function SpaceLens() {
    const { call } = useTauri();
    const [rootNode, setRootNode] = useState<FileNode | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const result = await call<FileNode>('scan_space_lens_command');
                setRootNode(result);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [call]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <motion.div
                                className="w-8 h-8 bg-purple-500/20 rounded-full"
                                animate={{ scale: [1, 1.5, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </div>
                    </div>
                    <p className="text-white/50 font-medium animate-pulse">Mapping storage universe...</p>
                </div>
            </div>
        );
    }

    if (!rootNode) return null;

    // Flatten children
    const children = rootNode.children || [];
    // Sort by size
    const topItems = [...children].sort((a, b) => b.size - a.size).slice(0, 20);

    return (
        <div className="h-full p-8 flex flex-col relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
            </div>

            <header className="mb-8 z-10">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
                            Space Lens
                        </h1>
                        <p className="text-white/50 flex items-center gap-2">
                            Visualizing <span className="bg-white/10 px-2 py-0.5 rounded text-white/80 font-mono text-xs">{rootNode.path}</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-4xl font-bold text-white">{formatBytes(rootNode.size)}</h2>
                        <p className="text-sm text-white/40">Total Size</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 relative rounded-3xl border border-white/10 bg-black/20 backdrop-blur-sm overflow-hidden p-8 shadow-inner">
                <div className="flex flex-wrap gap-2 items-center justify-center h-full content-center perspective-1000">
                    {topItems.map((child, idx) => (
                        <BubbleNode key={idx} node={child} totalSize={rootNode.size} index={idx} />
                    ))}
                </div>

                {children.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/30">
                        No files found or access denied.
                    </div>
                )}
            </div>

            <div className="mt-4 text-center text-xs text-white/30 z-10">
                Showing top {topItems.length} items by size
            </div>
        </div>
    );
}
