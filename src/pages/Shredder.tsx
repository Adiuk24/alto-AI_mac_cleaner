import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileX, Trash2, ShieldAlert } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export function Shredder() {
    const [shredding, setShredding] = useState(false);
    const [droppedPath, setDroppedPath] = useState<string | null>(null);

    // Tauris drop handler is handled via window events usually, but for simple web dnd we need the path
    // Since web dnd doesn't give full path for security, we rely on Tauri's file-drop event
    // or we simulate the UI for now. Real implementation needs:
    // import { listen } from '@tauri-apps/api/event';
    // listen('tauri://file-drop', ...)

    // Setup listener
    useEffect(() => {
        const unlistenPromise = listen('tauri://file-drop', (event) => {
            const paths = event.payload as string[];
            if (paths && paths.length > 0) {
                setDroppedPath(paths[0]);
            }
        });
        return () => { unlistenPromise.then(unlisten => unlisten()); }
    }, []);


    const handleShred = async () => {
        if (!droppedPath) return;
        setShredding(true);
        try {
            await invoke('shred_path_command', { path: droppedPath });
            setDroppedPath(null);
        } catch (error) {
            console.error(error);
            alert("Failed to shred: " + error);
        } finally {
            setShredding(false);
        }
    };

    return (
        <div className="h-full flex flex-col pt-8 px-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-200 to-gray-400">Shredder</h1>
                <p className="text-white/60 mt-1">Permanently erase files so they cannot be recovered.</p>
            </div>

            <div className="flex-1 flex items-center justify-center p-10">
                <AnimatePresence mode="wait">
                    {shredding ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center"
                        >
                            <div className="w-64 h-64 relative mx-auto mb-8">
                                <div className="absolute inset-0 bg-red-600/20 blur-3xl rounded-full animate-pulse" />
                                <div className="absolute inset-0 border-4 border-red-500/50 rounded-full animate-spin-slow border-t-transparent" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <FileX size={64} className="text-red-500 animate-bounce" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-red-500">Shredding...</h2>
                            <p className="text-white/40">Overwriting data sectors...</p>
                        </motion.div>
                    ) : droppedPath ? (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="glass-panel p-10 rounded-3xl text-center max-w-lg w-full"
                        >
                            <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <FileX size={40} className="text-red-500" />
                            </div>
                            <h3 className="text-xl font-bold mb-2 break-all">{droppedPath.split('/').pop()}</h3>
                            <p className="text-white/40 text-sm mb-8 break-all max-h-20 overflow-y-auto">{droppedPath}</p>

                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={() => setDroppedPath(null)}
                                    className="px-6 py-3 glass-button rounded-xl font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleShred}
                                    className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold shadow-lg shadow-red-900/20 flex items-center gap-2 transition-all hover:scale-105"
                                >
                                    <Trash2 size={18} /> Shred Immediately
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            className={`w-full max-w-md aspect-square rounded-[3rem] border-4 border-dashed flex flex-col items-center justify-center text-center p-10 transition-colors border-white/10 bg-white/5 hover:bg-white/10`}
                        >
                            <ShieldAlert size={80} className={`mb-6 text-white/20`} />
                            <h3 className="text-2xl font-bold text-white/80 mb-2">Drag files here</h3>
                            <p className="text-white/40">Drop any file or folder to securely erase it.</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
