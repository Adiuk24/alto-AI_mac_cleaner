import { useState } from 'react';
import { Trash2, CheckCircle } from 'lucide-react';
import { useTauri } from '../hooks/useTauri';
import { formatBytes } from '../utils/formatBytes';
import { playCompletionSound } from '../utils/sounds';

interface TrashItem {
    path: string;
    size_bytes: number;
    name: string;
}

export function TrashBins() {
    const { call } = useTauri();
    const [scanning, setScanning] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [items, setItems] = useState<TrashItem[]>([]);
    const [scanned, setScanned] = useState(false);
    const [cleaned, setCleaned] = useState(false);

    const handleScan = async () => {
        setScanning(true);
        setCleaned(false);
        try {
            // Scan common trash locations
            const foundItems: TrashItem[] = [];
            const result = await call<any>('scan_junk_command');
            console.log('Trash Scan Result:', result); // DEBUG
            if (result?.items) {
                foundItems.push(...result.items.filter((i: any) => i.path.includes('.Trash')).map((i: any) => ({
                    path: i.path,
                    size_bytes: Number(i.size_bytes),
                    name: i.path.split('/').pop() || i.path
                })));
            }
            setItems(foundItems);
            setScanned(true);
        } finally {
            setScanning(false);
            playCompletionSound();
        }
    };

    const handleClean = async () => {
        setCleaning(true);
        try {
            const paths = items.map(i => i.path);
            if (paths.length > 0) {
                await call('clean_items', { paths });
            }
            setCleaned(true);
            setItems([]);
        } finally {
            setCleaning(false);
        }
    };

    const totalSize = items.reduce((sum, i) => sum + i.size_bytes, 0);

    // Pre-scan state
    if (!scanned && !scanning) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                {/* Hero illustration */}
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center mb-8 shadow-2xl shadow-teal-500/30">
                    <Trash2 className="w-16 h-16 text-white/90" strokeWidth={1.5} />
                </div>

                <h2 className="text-3xl font-bold mb-3">Trash Bins</h2>
                <p className="text-white/50 mb-10 max-w-md leading-relaxed">
                    Empty all of the available Trash Bins on your system, including Mail and photo library trash.
                </p>

                {/* Feature cards */}
                <div className="space-y-4 mb-10 max-w-md w-full">
                    <div className="flex items-start gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                            <Trash2 size={18} className="text-teal-400" />
                        </div>
                        <div>
                            <p className="font-medium text-white/90">Empties all bins at once</p>
                            <p className="text-sm text-white/40">No need to browse all drives and apps to look for their Trash Bins.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                            <CheckCircle size={18} className="text-teal-400" />
                        </div>
                        <div>
                            <p className="font-medium text-white/90">Avoids various Finder errors</p>
                            <p className="text-sm text-white/40">Makes sure your Trash Bins are emptied disregarding any issues.</p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleScan}
                    className="w-16 h-16 rounded-full border-2 border-teal-400/50 bg-teal-500/10 hover:bg-teal-500/20 hover:border-teal-400 transition-all duration-300 flex items-center justify-center group shadow-lg shadow-teal-500/10"
                >
                    <span className="text-sm font-semibold text-teal-300 group-hover:text-teal-200">Scan</span>
                </button>
            </div>
        );
    }

    // Scanning state
    if (scanning) {
        return (
            <div className="h-full flex flex-col items-center justify-center">
                <div className="w-20 h-20 border-4 border-teal-200/20 border-t-teal-500 rounded-full animate-spin mb-6" />
                <p className="text-lg font-medium text-white/80">Scanning Trash Bins...</p>
            </div>
        );
    }

    // Results state
    return (
        <div className="h-full flex flex-col items-center justify-center p-10 text-center">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center mb-8 shadow-2xl shadow-teal-500/30">
                {cleaned
                    ? <CheckCircle className="w-14 h-14 text-white" />
                    : <Trash2 className="w-14 h-14 text-white/90" strokeWidth={1.5} />
                }
            </div>

            {cleaned ? (
                <>
                    <h2 className="text-3xl font-bold mb-2">All Clean!</h2>
                    <p className="text-white/50">Your Trash Bins have been emptied.</p>
                </>
            ) : (
                <>
                    <h2 className="text-3xl font-bold mb-2">Scan completed</h2>
                    <p className="text-4xl font-bold text-teal-400 my-4">{formatBytes(totalSize)}</p>
                    <p className="text-white/40 mb-2">{items.length} items in Trash</p>

                    <button
                        onClick={handleClean}
                        disabled={cleaning || items.length === 0}
                        className="mt-8 w-16 h-16 rounded-full border-2 border-teal-400/50 bg-teal-500/10 hover:bg-teal-500/20 hover:border-teal-400 transition-all duration-300 flex items-center justify-center group shadow-lg shadow-teal-500/10 disabled:opacity-40"
                    >
                        <span className="text-sm font-semibold text-teal-300 group-hover:text-teal-200">
                            {cleaning ? '...' : 'Clean'}
                        </span>
                    </button>
                </>
            )}
        </div>
    );
}

