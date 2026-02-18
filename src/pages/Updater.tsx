import { useState, useEffect } from 'react';
import { RefreshCw, Download, CheckCircle2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface OutdatedApp {
    name: string;
    current_version: string;
    latest_version: string;
}

export function Updater() {
    const [apps, setApps] = useState<OutdatedApp[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await invoke<OutdatedApp[]>('scan_outdated_apps_command');
                setApps(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    return (
        <div className="h-full flex flex-col pt-8 px-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400">Updater</h1>
                <p className="text-white/60 mt-1">Keep your apps fresh and secure.</p>
            </div>

            <div className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                    <span className="font-medium text-sm">{apps.length} Updates Available</span>
                    <button onClick={() => window.location.reload()} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <RefreshCw size={16} className={`${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-white/40 gap-2">
                            <RefreshCw className="animate-spin" /> Checking for updates...
                        </div>
                    ) : apps.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-white/40 gap-4">
                            <CheckCircle2 size={48} className="opacity-50" />
                            <p>All your apps are up to date!</p>
                        </div>
                    ) : (
                        apps.map((app, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl mb-2 hover:bg-white/10 transition-colors">
                                <div>
                                    <div className="font-bold">{app.name}</div>
                                    <div className="text-xs text-white/50 flex gap-2 mt-1">
                                        <span className="bg-white/10 px-2 py-0.5 rounded">{app.current_version}</span>
                                        <span>➜</span>
                                        <span className="text-green-400">{app.latest_version}</span>
                                    </div>
                                </div>
                                <button className="px-4 py-2 bg-blue-500 hover:bg-blue-400 rounded-lg font-bold text-sm flex items-center gap-2">
                                    <Download size={16} /> Update
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
