import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Trash2, CheckCircle, Globe, Chrome, Lock } from 'lucide-react';
import { useTauri } from '../hooks/useTauri';
import { Button } from '../components/Button';
import { formatBytes } from '../utils/formatBytes';

interface PrivacyItem {
    id: string;
    browser: string;
    data_type: string;
    path: string;
    size_bytes: number;
    description: string;
}

export function Privacy() {
    const { call } = useTauri();
    const [scanning, setScanning] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [cleaned, setCleaned] = useState(false);
    const [items, setItems] = useState<PrivacyItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [cleaning, setCleaning] = useState(false);

    const handleScan = async () => {
        setScanning(true);
        setCleaned(false);
        try {
            // Artificial delay for UX
            await new Promise(resolve => setTimeout(resolve, 800));

            const result = await call<PrivacyItem[]>('scan_privacy_command');
            setItems(result || []);

            // Select all by default
            const allPaths = new Set((result || []).map(i => i.path));
            setSelectedItems(allPaths);
            setScanned(true);
        } catch (e) {
            console.error("Privacy scan failed:", e);
        } finally {
            setScanning(false);
        }
    };

    const handleClean = async () => {
        const paths = Array.from(selectedItems);
        if (paths.length === 0) return;

        setCleaning(true);
        try {
            // Clean items one by one or batch if supported
            // Our backend command takes a single path: clean_privacy_item_command(path)
            // Ideally backend would take a list, but let's loop for now
            for (const path of paths) {
                await call('clean_privacy_item_command', { path });
            }

            setCleaned(true);
            setItems([]);
            setSelectedItems(new Set());
        } catch (e) {
            console.error("Privacy clean failed:", e);
        } finally {
            setCleaning(false);
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

    const totalSize = items.filter(i => selectedItems.has(i.path)).reduce((sum, i) => sum + i.size_bytes, 0);

    // Group items by Browser
    const grouped = items.reduce((acc, item) => {
        if (!acc[item.browser]) acc[item.browser] = [];
        acc[item.browser].push(item);
        return acc;
    }, {} as Record<string, PrivacyItem[]>);

    // Pre-scan state
    if (!scanned && !scanning) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                <div className="w-32 h-32 rounded-full bg-linear-to-br from-amber-400 to-orange-600 flex items-center justify-center mb-8 shadow-2xl shadow-orange-500/30">
                    <Eye className="w-16 h-16 text-white/90" strokeWidth={1.5} />
                </div>

                <h2 className="text-3xl font-bold mb-3">Privacy Protection</h2>
                <p className="text-white/50 mb-10 max-w-md leading-relaxed">
                    Scan your browsers for tracking cookies, history, and sensitive logs that can compromise your privacy.
                </p>

                <div className="space-y-4 mb-10 max-w-md w-full">
                    <div className="flex items-start gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                            <Globe size={18} className="text-amber-400" />
                        </div>
                        <div>
                            <p className="font-medium text-white/90">Browser Cleanup</p>
                            <p className="text-sm text-white/40">Removes history, cookies, and cache from Chrome, Safari, and Brave.</p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleScan}
                    className="w-16 h-16 rounded-full border-2 border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-400 transition-all duration-300 flex items-center justify-center group shadow-lg shadow-amber-500/10"
                >
                    <span className="text-sm font-semibold text-amber-300 group-hover:text-amber-200">Scan</span>
                </button>
            </div>
        );
    }

    // Scanning state
    if (scanning) {
        return (
            <div className="h-full flex flex-col items-center justify-center">
                <div className="w-20 h-20 border-4 border-amber-200/20 border-t-amber-500 rounded-full animate-spin mb-6" />
                <p className="text-lg font-medium text-white/80">Scanning browser data...</p>
                <p className="text-sm text-white/40 mt-2">Checking Chrome, Safari, and Brave</p>
            </div>
        );
    }

    // Cleaned state
    if (cleaned) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                <div className="w-28 h-28 rounded-full bg-linear-to-br from-emerald-400 to-green-600 flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/30">
                    <CheckCircle className="w-14 h-14 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-2">Privacy Secured!</h2>
                <p className="text-white/50">Your browser tracks have been wiped.</p>
                <Button onClick={() => { setScanned(false); setCleaned(false); }} variant="secondary" className="mt-8">
                    Done
                </Button>
            </div>
        );
    }

    // Results state
    return (
        <div className="h-full flex flex-col p-6">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Privacy Scan Results</h1>
                    <p className="text-white/50">{items.length} traces found · {formatBytes(totalSize)} selected</p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={() => { setScanned(false); setItems([]); }} variant="secondary" size="sm">Start Over</Button>
                    <Button
                        onClick={handleClean}
                        variant="primary"
                        size="sm"
                        disabled={selectedItems.size === 0 || cleaning}
                        className="gap-2 bg-amber-500 hover:bg-amber-600 border-amber-600"
                    >
                        {cleaning ? 'Cleaning...' : <><Trash2 size={16} /> Remove Selected</>}
                    </Button>
                </div>
            </header>

            <div className="flex-1 overflow-auto bg-white/5 rounded-xl border border-white/10">
                {Object.entries(grouped).map(([browser, browserItems]) => (
                    <div key={browser} className="border-b border-white/5 last:border-0">
                        <div className="px-4 py-3 bg-white/5 flex items-center gap-3">
                            <Chrome size={16} className="text-amber-400" />
                            <span className="font-medium text-sm">{browser}</span>
                            <span className="text-xs text-white/40 ml-auto">{formatBytes(browserItems.reduce((s, i) => s + i.size_bytes, 0))}</span>
                        </div>
                        {browserItems.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer"
                                onClick={() => toggleItem(item.path)}
                            >
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedItems.has(item.path)
                                    ? 'bg-amber-500 border-amber-500'
                                    : 'border-white/20'
                                    }`}>
                                    {selectedItems.has(item.path) && <CheckCircle size={12} className="text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium truncate">{item.description}</p>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">{item.data_type}</span>
                                    </div>
                                    <p className="text-xs text-white/30 truncate" title={item.path}>{item.path}</p>
                                </div>
                                <span className="text-xs text-white/40 font-mono">{formatBytes(item.size_bytes)}</span>
                            </motion.div>
                        ))}
                    </div>
                ))}
                {items.length === 0 && (
                    <div className="h-full flex items-center justify-center text-white/40 py-20 flex-col gap-4">
                        <Lock size={48} className="opacity-20" />
                        <p>No privacy traces found — your data is clean!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
