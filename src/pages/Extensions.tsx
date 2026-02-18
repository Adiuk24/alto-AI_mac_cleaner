import { useState, useEffect } from 'react';
import { Puzzle, Zap, Trash2, Power } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface ExtensionItem {
    path: string;
    name: string;
    kind: string;
    enabled: boolean;
}

export function Extensions() {
    const [items, setItems] = useState<ExtensionItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        try {
            const data = await invoke<ExtensionItem[]>('scan_extensions_command');
            setItems(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (path: string) => {
        if (!confirm('Are you sure? This will remove the startup item permanently.')) return;
        try {
            await invoke('remove_extension_command', { path });
            setItems(items.filter(i => i.path !== path));
        } catch (e) {
            alert('Failed to remove: ' + e);
        }
    };

    return (
        <div className="h-full flex flex-col pt-8 px-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">Extensions</h1>
                <p className="text-white/60 mt-1">Manage Launch Agents and startup items to speed up boot time.</p>
            </div>

            <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center text-sm font-medium text-white/50">
                    <span>{items.length} Startup Items</span>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-white/40 gap-2">
                            <Puzzle className="animate-spin" /> Scanning extensions...
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-white/40 gap-4">
                            <Zap size={48} className="text-yellow-500/50" />
                            <p>No startup items found.</p>
                        </div>
                    ) : (
                        items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                                        <Power size={20} className="text-yellow-400" />
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="font-bold truncate max-w-md">{item.name}</div>
                                        <div className="text-xs text-white/50">{item.kind}</div>
                                        <div className="text-[10px] text-white/30 truncate max-w-xs">{item.path}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemove(item.path)}
                                    className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all font-medium text-sm flex items-center gap-2"
                                >
                                    <Trash2 size={16} /> Remove
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
