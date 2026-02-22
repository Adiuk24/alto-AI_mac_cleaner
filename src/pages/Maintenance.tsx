import { useState, useEffect } from 'react';
import { useTauri } from '../hooks/useTauri';
import {
    MemoryStick,
    FileCode,
    Globe,
    Search,
    ShieldCheck,
    Loader2,
    Type,
    Terminal,
    ChevronRight,
    Zap
} from 'lucide-react';
import { playCompletionSound } from '../utils/sounds';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface MaintenanceTask {
    id: string;
    name: string;
    description: string;
    command: string; // Internal command string, not shown to user
    requires_sudo: boolean;
}

const ICON_MAP: Record<string, any> = {
    'free_ram': MemoryStick,
    'flush_dns': Globe,
    'reindex_spotlight': Search,
    'repair_disk_perms': ShieldCheck,
    'clear_font_cache': Type,
    'default': FileCode
};

export function Maintenance() {
    const { call } = useTauri();
    const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [runningTask, setRunningTask] = useState<string | null>(null);
    const [taskLogs, setTaskLogs] = useState<Record<string, { status: 'success' | 'error', output: string }>>({});

    useEffect(() => {
        loadTasks();
    }, []);

    const loadTasks = async () => {
        try {
            const result = await call<MaintenanceTask[]>('get_maintenance_tasks_command');
            if (result) {
                setTasks(result);
                if (result.length > 0) {
                    setSelectedTaskId(result[0].id);
                }
            }
        } catch (e) {
            console.error("Failed to load maintenance tasks", e);
        }
    };

    const selectedTask = tasks.find(t => t.id === selectedTaskId);

    const runTask = async () => {
        if (!selectedTask || runningTask) return;

        setRunningTask(selectedTask.id);
        setTaskLogs(prev => ({ ...prev, [selectedTask.id]: { status: 'success', output: 'Running...' } })); // Reset log

        try {
            const output = await call<string>('run_maintenance_task_command', { id: selectedTask.id });

            setTaskLogs(prev => ({
                ...prev,
                [selectedTask.id]: { status: 'success', output: output || "Task completed successfully." }
            }));
            playCompletionSound();
        } catch (e: any) {
            setTaskLogs(prev => ({
                ...prev,
                [selectedTask.id]: { status: 'error', output: typeof e === 'string' ? e : "Task failed. Ensure you have permissions." }
            }));
        } finally {
            setRunningTask(null);
        }
    };

    return (
        <div className="h-full w-full bg-transparent text-white flex flex-col font-sans overflow-hidden relative">
            {/* Background Accents (Kept from original design) */}
            <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-pink-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-900/40 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="h-14 flex items-center justify-between px-6 shrink-0 z-20">
                <div className="flex items-center gap-2 text-white/50 text-sm">
                    <span>Checking System...</span>
                </div>
                <div className="text-white/30 text-xs font-medium uppercase tracking-wider">Maintenance</div>
                <div className="flex items-center gap-2">
                    {/* Placeholder for future status */}
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden z-10 px-8 pb-8 gap-12">
                {/* Left Panel: Task List */}
                <div className="w-[420px] flex flex-col pt-6 overflow-y-auto custom-scrollbar">
                    <div className="space-y-3">
                        {tasks.map(task => {
                            const isSelected = selectedTaskId === task.id;
                            const log = taskLogs[task.id];
                            const isDone = log?.status === 'success';
                            const isError = log?.status === 'error';
                            const Icon = ICON_MAP[task.id] || ICON_MAP['default'];

                            return (
                                <button
                                    key={task.id}
                                    onClick={() => setSelectedTaskId(task.id)}
                                    className={cn(
                                        "group w-full flex items-center gap-5 px-5 py-4 rounded-2xl transition-all duration-300 text-left relative overflow-hidden active:scale-[0.98]",
                                        isSelected
                                            ? "glass-frost border-white/20 bg-white/10 shadow-2xl"
                                            : "hover:bg-white/5 border border-transparent"
                                    )}
                                >
                                    {/* Status Indicator */}
                                    <div className={cn(
                                        "w-2 h-2 rounded-full transition-all duration-500",
                                        isError ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" :
                                            isDone ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" :
                                                isSelected ? "bg-primary animate-pulse shadow-[0_0_10px_rgba(236,72,153,0.5)]" : "bg-white/20"
                                    )} />

                                    {/* Icon Box */}
                                    <div className={cn(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500",
                                        isSelected ? "bg-primary/20 ring-1 ring-primary/40" : "bg-white/5"
                                    )}>
                                        <Icon size={22} className={isSelected ? "text-primary" : "text-white/40 group-hover:text-white/60"} />
                                    </div>

                                    {/* Label */}
                                    <div className="flex flex-col flex-1">
                                        <span className={cn(
                                            "font-bold text-[15px] tracking-wide transition-colors",
                                            isSelected ? "text-white" : "text-white/50 group-hover:text-white/80"
                                        )}>
                                            {task.name}
                                        </span>
                                        {task.requires_sudo && (
                                            <span className="text-[9px] text-primary/60 font-black uppercase tracking-[0.2em] mt-0.5">Admin Rights</span>
                                        )}
                                    </div>

                                    {isSelected && <ChevronRight size={18} className="text-white/20" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Details & Output */}
                <div className="flex-1 flex flex-col pt-12 relative pr-4">
                    <AnimatePresence mode="wait">
                        {selectedTask && (
                            <motion.div
                                key={selectedTask.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                className="flex-1 flex flex-col"
                            >
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-1.5 h-10 bg-primary/40 rounded-full" />
                                    <h1 className="text-5xl font-black text-white uppercase tracking-tighter shimmer-text">{selectedTask.name}</h1>
                                </div>
                                <p className="text-xl text-white/40 leading-relaxed mb-12 max-w-2xl font-medium">
                                    {selectedTask.description}
                                </p>

                                {/* Terminal Output Box */}
                                <div className="flex-1 w-full glass-frost rounded-[2rem] border border-white/10 p-8 font-mono text-xs overflow-hidden flex flex-col shadow-2xl relative group">
                                    <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

                                    <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                                        <div className="flex items-center gap-3 text-white/40">
                                            <Terminal size={14} className="text-primary" />
                                            <span className="uppercase tracking-[0.2em] font-black">Process Terminal</span>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-white/5" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-white/5" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-white/5" />
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-white/60 custom-scrollbar leading-relaxed">
                                        {taskLogs[selectedTask.id]?.output || <span className="text-white/20 italic uppercase tracking-widest text-[10px]">Ready for sequence...</span>}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Action Button Area */}
                    <div className="mt-12 flex justify-center pb-2">
                        <button
                            onClick={runTask}
                            disabled={runningTask !== null}
                            className="btn-scan"
                        >
                            {runningTask ? (
                                <div className="flex items-center gap-3">
                                    <Loader2 size={24} className="animate-spin" />
                                    <span>Running</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <Zap size={22} className="fill-white" />
                                    <span>Run</span>
                                </div>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
