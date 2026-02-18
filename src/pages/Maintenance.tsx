import { useState } from 'react';
import { useTauri } from '../hooks/useTauri';
import type { SpeedTaskResult } from '../types';
import { Hammer, RotateCcw, Trash2, HardDrive, RefreshCw, CheckCircle } from 'lucide-react';
import { playCompletionSound } from '../utils/sounds';

const tasks = [
    { id: 'flush_dns', label: 'Flush DNS Cache', description: 'Resolve network connectivity issues by clearing stale DNS entries.', icon: RotateCcw, color: 'cyan' },
    { id: 'free_ram', label: 'Free Up RAM', description: 'Release inactive memory to improve application performance.', icon: RefreshCw, color: 'cyan' },
    { id: 'rebuild_spotlight', label: 'Rebuild Spotlight Index', description: 'Fix search issues by reindexing Spotlight.', icon: HardDrive, color: 'cyan' },
    { id: 'clear_tmp', label: 'Clear Temporary Files', description: 'Remove leftover temp files from system processes.', icon: Trash2, color: 'cyan' },
];

export function Maintenance() {
    const { call } = useTauri();
    const [runningTask, setRunningTask] = useState<string | null>(null);
    const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

    const runTask = async (taskId: string) => {
        setRunningTask(taskId);
        try {
            await call<SpeedTaskResult>('run_speed_task_command', { taskId });
            setCompletedTasks(prev => new Set(prev).add(taskId));
            playCompletionSound();
        } catch (e) {
            console.error(e);
        } finally {
            setRunningTask(null);
        }
    };

    const runAll = async () => {
        for (const task of tasks) {
            if (!completedTasks.has(task.id)) {
                await runTask(task.id);
            }
        }
    };

    const allDone = tasks.every(t => completedTasks.has(t.id));

    return (
        <div className="h-full flex flex-col items-center justify-center p-10">
            {/* Hero */}
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center mb-8 shadow-2xl shadow-cyan-500/30">
                <Hammer className="w-16 h-16 text-white/90" strokeWidth={1.5} />
            </div>

            <h2 className="text-3xl font-bold mb-3 text-center">Maintenance</h2>
            <p className="text-white/50 mb-10 max-w-md text-center leading-relaxed">
                Run essential maintenance tasks to keep your Mac in top shape.
            </p>

            {/* Task list */}
            <div className="w-full max-w-lg space-y-3 mb-10">
                {tasks.map(task => {
                    const Icon = task.icon;
                    const isRunning = runningTask === task.id;
                    const isDone = completedTasks.has(task.id);

                    return (
                        <button
                            key={task.id}
                            onClick={() => !isDone && !isRunning && runTask(task.id)}
                            disabled={isRunning || runningTask !== null}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${isDone
                                    ? 'bg-emerald-500/5 border-emerald-500/20'
                                    : isRunning
                                        ? 'bg-cyan-500/5 border-cyan-500/20'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-cyan-500/30'
                                } disabled:cursor-not-allowed`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDone
                                    ? 'bg-emerald-500/20'
                                    : 'bg-cyan-500/10 border border-cyan-500/20'
                                }`}>
                                {isDone
                                    ? <CheckCircle size={18} className="text-emerald-400" />
                                    : isRunning
                                        ? <div className="w-4 h-4 border-2 border-cyan-200/20 border-t-cyan-400 rounded-full animate-spin" />
                                        : <Icon size={18} className="text-cyan-400" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`font-medium ${isDone ? 'text-emerald-300' : 'text-white/90'}`}>{task.label}</p>
                                <p className="text-sm text-white/40">{task.description}</p>
                            </div>
                            {isDone && <span className="text-xs text-emerald-400 font-medium shrink-0">Done</span>}
                            {isRunning && <span className="text-xs text-cyan-400 font-medium shrink-0">Running...</span>}
                        </button>
                    );
                })}
            </div>

            {/* Run All button */}
            {!allDone && (
                <button
                    onClick={runAll}
                    disabled={runningTask !== null}
                    className="w-16 h-16 rounded-full border-2 border-cyan-400/50 bg-cyan-500/10 hover:bg-cyan-500/20 hover:border-cyan-400 transition-all duration-300 flex items-center justify-center group shadow-lg shadow-cyan-500/10 disabled:opacity-40"
                >
                    <span className="text-xs font-semibold text-cyan-300 group-hover:text-cyan-200">
                        {runningTask ? '...' : 'Run All'}
                    </span>
                </button>
            )}

            {allDone && (
                <div className="text-center">
                    <p className="text-emerald-400 font-medium mb-2">All maintenance tasks completed!</p>
                    <button
                        onClick={() => setCompletedTasks(new Set())}
                        className="text-sm text-white/40 hover:text-white transition-colors"
                    >
                        Reset & run again
                    </button>
                </div>
            )}
        </div>
    );
}
