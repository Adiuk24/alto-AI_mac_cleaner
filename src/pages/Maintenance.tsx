import { useState, useEffect } from 'react';
import { useTauri } from '../hooks/useTauri';
import {
    MemoryStick,
    FileCode,
    Globe,
    Search,
    ShieldCheck,
    CheckCircle2,
    Loader2,
    Type,
    AlertTriangle,
    Terminal
} from 'lucide-react';
import { playCompletionSound } from '../utils/sounds';
import { AnimatePresence, motion } from 'framer-motion';

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
                <div className="w-[420px] flex flex-col pt-4 overflow-y-auto">
                    <div className="space-y-1">
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
                                    className={`group w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-left relative overflow-hidden ${isSelected
                                        ? 'bg-white/10 shadow-lg backdrop-blur-md'
                                        : 'hover:bg-white/5'
                                        }`}
                                >
                                    {/* Status Indicator */}
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${isSelected
                                        ? 'border-white bg-white/20'
                                        : isError
                                            ? 'border-red-400 bg-red-400/20'
                                            : isDone
                                                ? 'border-emerald-400 bg-emerald-400/20'
                                                : 'border-white/30 group-hover:border-white/50'
                                        }`}>
                                        {isError && <AlertTriangle size={12} className="text-red-400" />}
                                        {isDone && !isError && <CheckCircle2 size={12} className="text-emerald-400" />}
                                        {isSelected && !isDone && !isError && <div className="w-2 h-2 rounded-full bg-white" />}
                                    </div>

                                    {/* Icon Box */}
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-blue-500 shadow-md' : 'bg-white/10'
                                        }`}>
                                        <Icon size={20} className="text-white" />
                                    </div>

                                    {/* Label */}
                                    <div className="flex flex-col">
                                        <span className={`font-medium text-[15px] ${isSelected ? 'text-white' : 'text-white/80'}`}>
                                            {task.name}
                                        </span>
                                        {task.requires_sudo && (
                                            <span className="text-[10px] text-white/40 uppercase tracking-wider">Requires Admin</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Details & Output */}
                <div className="flex-1 flex flex-col pt-8 pr-12 relative">
                    <AnimatePresence mode="wait">
                        {selectedTask && (
                            <motion.div
                                key={selectedTask.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 flex flex-col"
                            >
                                <h1 className="text-4xl font-bold mb-6 text-white">{selectedTask.name}</h1>
                                <p className="text-lg text-white/70 leading-relaxed mb-8 max-w-xl">
                                    {selectedTask.description}
                                </p>

                                {/* Terminal Output Box */}
                                <div className="flex-1 w-full bg-black/40 rounded-lg border border-white/10 p-4 font-mono text-sm overflow-hidden flex flex-col max-h-[300px]">
                                    <div className="flex items-center gap-2 text-white/30 mb-2 border-b border-white/5 pb-2">
                                        <Terminal size={14} />
                                        <span>Output Log</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-white/80">
                                        {taskLogs[selectedTask.id]?.output || <span className="text-white/30 italic">Ready to run...</span>}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Floating Action Button */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
                        <button
                            onClick={runTask}
                            disabled={runningTask !== null}
                            className={`
                                group relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300
                                ${runningTask
                                    ? 'bg-white/5 cursor-wait'
                                    : 'bg-white/10 hover:bg-white/20 active:scale-95 cursor-pointer shadow-2xl shadow-purple-900/50 hover:shadow-purple-700/50'
                                }
                            `}
                        >
                            <div className="absolute inset-0 rounded-full border-[6px] border-[#3E2348] opacity-80" />
                            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center backdrop-blur-sm">
                                {runningTask ? (
                                    <Loader2 size={32} className="text-white/60 animate-spin" />
                                ) : (
                                    <span className="text-lg font-medium text-white/80 group-hover:text-white transition-colors">Run</span>
                                )}
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
