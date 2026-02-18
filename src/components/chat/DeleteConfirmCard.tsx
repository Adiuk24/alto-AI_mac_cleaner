import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Trash2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { formatBytes } from '../../utils/formatBytes';

export interface IndexedFile {
    path: string;
    size_bytes: number;
    category: 'Cache' | 'Log' | 'Temp' | 'UserData' | 'SystemCritical' | 'AppSupport' | 'Unknown';
    app_owner: string | null;
    is_safe_to_delete: boolean;
    reason: string;
}

interface DeleteConfirmCardProps {
    files: IndexedFile[];
    onConfirm: (safePaths: string[]) => void;
    onCancel: () => void;
}

const categoryColors: Record<string, string> = {
    Cache: 'text-blue-400',
    Log: 'text-cyan-400',
    Temp: 'text-teal-400',
    UserData: 'text-red-400',
    SystemCritical: 'text-red-500',
    AppSupport: 'text-orange-400',
    Unknown: 'text-white/50',
};

export function DeleteConfirmCard({ files, onConfirm, onCancel }: DeleteConfirmCardProps) {
    const safeFiles = files.filter(f => f.is_safe_to_delete);
    const blockedFiles = files.filter(f => !f.is_safe_to_delete);
    const totalSafe = safeFiles.reduce((acc, f) => acc + f.size_bytes, 0);
    const hasBlocked = blockedFiles.length > 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-lg bg-[#1A1B2E] border border-white/10 rounded-2xl overflow-hidden shadow-2xl my-4"
        >
            {/* Header */}
            <div className={`p-4 flex items-center gap-3 border-b border-white/5 ${hasBlocked ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                {hasBlocked ? (
                    <AlertTriangle className="text-amber-400 shrink-0" size={20} />
                ) : (
                    <ShieldCheck className="text-emerald-400 shrink-0" size={20} />
                )}
                <div>
                    <p className="font-semibold text-sm text-white">
                        {hasBlocked ? 'Safety Review Required' : 'Ready to Clean'}
                    </p>
                    <p className="text-xs text-white/50">
                        {safeFiles.length} safe to delete · {blockedFiles.length} blocked · {formatBytes(totalSafe)} will be freed
                    </p>
                </div>
            </div>

            {/* Blocked Files Warning */}
            {hasBlocked && (
                <div className="px-4 py-3 bg-red-500/5 border-b border-red-500/10">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert size={14} className="text-red-400" />
                        <span className="text-xs font-semibold text-red-300 uppercase tracking-wide">Protected — Will NOT be deleted</span>
                    </div>
                    <div className="space-y-1">
                        {blockedFiles.map((f, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-white/60">
                                <XCircle size={12} className="text-red-400 mt-0.5 shrink-0" />
                                <div>
                                    <span className="font-mono text-white/40 truncate block max-w-[300px]">{f.path.split('/').pop()}</span>
                                    <span className="text-white/30">{f.reason}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Safe Files List */}
            {safeFiles.length > 0 && (
                <div className="px-4 py-3 max-h-48 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wide">Safe to Delete</span>
                    </div>
                    <div className="space-y-1.5">
                        {safeFiles.map((f, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Trash2 size={12} className="text-white/30 shrink-0" />
                                    <span className="font-mono text-white/60 truncate">{f.path.split('/').pop()}</span>
                                    <span className={`shrink-0 ${categoryColors[f.category] || 'text-white/40'}`}>{f.category}</span>
                                </div>
                                <span className="text-white/40 shrink-0">{formatBytes(f.size_bytes)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="p-4 border-t border-white/5 flex gap-3">
                <button
                    onClick={onCancel}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-sm text-white/70 font-medium transition-colors"
                >
                    Cancel
                </button>
                {safeFiles.length > 0 && (
                    <button
                        onClick={() => onConfirm(safeFiles.map(f => f.path))}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-500/20"
                    >
                        Delete {safeFiles.length} Files
                    </button>
                )}
            </div>
        </motion.div>
    );
}
