import { useState } from 'react';
import { useTauri } from '../hooks/useTauri';
import type { SpeedTaskResult } from '../types';
import { Zap, Gauge, CheckCircle, Activity } from 'lucide-react';
import { playCompletionSound } from '../utils/sounds';

const tasks = [
    { id: 'free_ram', label: 'Free Up RAM', description: 'Clear inactive memory to boost application speed.', icon: Zap },
    { id: 'flush_dns', label: 'Flush DNS Cache', description: 'Solve network connectivity issues instantly.', icon: Gauge },
];

export function Optimization() {
    const { call } = useTauri();
    const [runningTask, setRunningTask] = useState<string | null>(null);
    const [results, setResults] = useState<Record<string, string>>({});

    const runTask = async (taskId: string) => {
        setRunningTask(taskId);
        try {
            const res = await call<SpeedTaskResult>('run_speed_task_command', { taskId: taskId });
            if (res) {
                setResults(prev => ({ ...prev, [taskId]: res.status }));
                playCompletionSound();
            }
        } catch (e) {
            console.error(e);
            setResults(prev => ({ ...prev, [taskId]: 'Failed' }));
        } finally {
            setRunningTask(null);
        }
    };

    const allDone = tasks.every(t => results[t.id]);

    return (
        <div className="h-full flex flex-col items-center justify-center p-10">
            {/* Hero */}
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mb-8 shadow-2xl shadow-yellow-500/30">
                <Activity className="w-16 h-16 text-white/90" strokeWidth={1.5} />
            </div>

            <h2 className="text-3xl font-bold mb-3 text-center">Optimization</h2>
            <p className="text-white/50 mb-10 max-w-md text-center leading-relaxed">
                Boost your Mac's performance by freeing up memory and clearing DNS cache.
            </p>

            {/* Pre-scan feature cards */}
            <div className="space-y-4 mb-10 max-w-md w-full">
                <div className="flex items-start gap-4 text-left">
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                        <Zap size={18} className="text-yellow-400" />
                    </div>
                    <div>
                        <p className="font-medium text-white/90">Speed boost</p>
                        <p className="text-sm text-white/40">Free up inactive RAM to give your apps more breathing room.</p>
                    </div>
                </div>
                <div className="flex items-start gap-4 text-left">
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                        <Gauge size={18} className="text-yellow-400" />
                    </div>
                    <div>
                        <p className="font-medium text-white/90">Network fix</p>
                        <p className="text-sm text-white/40">Flush stale DNS entries to resolve connectivity issues.</p>
                    </div>
                </div>
            </div>

            {/* Task list */}
            <div className="w-full max-w-lg space-y-3 mb-10">
                {tasks.map(task => {
                    const Icon = task.icon;
                    const isRunning = runningTask === task.id;
                    const isDone = !!results[task.id];

                    return (
                        <button
                            key={task.id}
                            onClick={() => !isDone && !isRunning && runTask(task.id)}
                            disabled={isRunning || (runningTask !== null && !isDone)}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${isDone
                                    ? 'bg-emerald-500/5 border-emerald-500/20'
                                    : isRunning
                                        ? 'bg-yellow-500/5 border-yellow-500/20'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-yellow-500/30'
                                } disabled:cursor-not-allowed`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDone
                                    ? 'bg-emerald-500/20'
                                    : 'bg-yellow-500/10 border border-yellow-500/20'
                                }`}>
                                {isDone
                                    ? <CheckCircle size={18} className="text-emerald-400" />
                                    : isRunning
                                        ? <div className="w-4 h-4 border-2 border-yellow-200/20 border-t-yellow-400 rounded-full animate-spin" />
                                        : <Icon size={18} className="text-yellow-400" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`font-medium ${isDone ? 'text-emerald-300' : 'text-white/90'}`}>{task.label}</p>
                                <p className="text-sm text-white/40">{task.description}</p>
                            </div>
                            {isDone && <span className="text-xs text-emerald-400 font-medium shrink-0">{results[task.id]}</span>}
                            {isRunning && <span className="text-xs text-yellow-400 font-medium shrink-0">Running...</span>}
                        </button>
                    );
                })}
            </div>

            {allDone ? (
                <div className="text-center">
                    <p className="text-emerald-400 font-medium mb-2">All optimizations completed!</p>
                    <button
                        onClick={() => setResults({})}
                        className="text-sm text-white/40 hover:text-white transition-colors"
                    >
                        Run again
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => tasks.forEach(t => !results[t.id] && runTask(t.id))}
                    disabled={runningTask !== null}
                    className="w-16 h-16 rounded-full border-2 border-yellow-400/50 bg-yellow-500/10 hover:bg-yellow-500/20 hover:border-yellow-400 transition-all duration-300 flex items-center justify-center group shadow-lg shadow-yellow-500/10 disabled:opacity-40"
                >
                    <span className="text-xs font-semibold text-yellow-300 group-hover:text-yellow-200">
                        {runningTask ? '...' : 'Run'}
                    </span>
                </button>
            )}
        </div>
    );
}
