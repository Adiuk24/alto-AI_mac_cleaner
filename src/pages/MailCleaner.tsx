import { useState, useEffect } from 'react';
import { Mail, CheckCircle2, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { formatBytes } from '../utils/formatBytes';

interface Attachment {
    path: string;
    name: string;
    size_bytes: number;
}

export function MailCleaner() {
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [cleaning, setCleaning] = useState(false);

    useEffect(() => {
        const load = async () => {
            const data = await invoke<Attachment[]>('scan_mail_command');
            setAttachments(data);
            setLoading(false);
        };
        load();
    }, []);

    const totalSize = attachments.reduce((acc, curr) => acc + curr.size_bytes, 0);

    const handleClean = async () => {
        setCleaning(true);
        try {
            const paths = attachments.map(a => a.path);
            await invoke('clean_mail_command', { paths });
            setAttachments([]);
        } catch (e) {
            console.error(e);
            alert("Failed to clean mail: " + e);
        } finally {
            setCleaning(false);
        }
    };

    return (
        <div className="h-full flex flex-col pt-8 px-6">
            <div className="mb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">Mail Attachments</h1>
                    <p className="text-white/60 mt-1">Remove local copies of email attachments to save space.</p>
                </div>
                {attachments.length > 0 && (
                    <div className="text-right">
                        <div className="text-2xl font-bold text-white">{formatBytes(totalSize)}</div>
                        <div className="text-xs text-white/40">Total Potential Saving</div>
                    </div>
                )}
            </div>

            <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center text-sm font-medium text-white/50">
                    <span>{attachments.length} Files Found</span>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-white/40 gap-2">
                            <Mail className="animate-bounce" /> Scanning Mailbox...
                        </div>
                    ) : attachments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-white/40 gap-4">
                            <CheckCircle2 size={48} className="text-green-500/50" />
                            <p>Your mailbox is clean!</p>
                        </div>
                    ) : (
                        attachments.map((file, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl mb-1 hover:bg-white/10 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <Mail size={16} className="text-blue-400 shrink-0" />
                                    <span className="truncate text-sm">{file.name}</span>
                                </div>
                                <span className="text-xs text-white/50 whitespace-nowrap">{formatBytes(file.size_bytes)}</span>
                            </div>
                        ))
                    )}
                </div>

                {attachments.length > 0 && (
                    <div className="p-4 border-t border-white/10 bg-white/5">
                        <button
                            onClick={handleClean}
                            disabled={cleaning}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {cleaning ? 'Cleaning...' : (
                                <>
                                    <Trash2 size={18} /> Clean All ({formatBytes(totalSize)})
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
