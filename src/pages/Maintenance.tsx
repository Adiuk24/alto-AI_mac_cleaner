import { useState, useMemo } from 'react';
import { useTauri } from '../hooks/useTauri';
import type { SpeedTaskResult } from '../types';
import {
    MemoryStick,
    HardDrive,
    FileCode,
    Globe,
    Mail,
    Search,
    ShieldCheck,
    History,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { playCompletionSound } from '../utils/sounds';
import { AnimatePresence, motion } from 'framer-motion';

interface MaintenanceTask {
    id: string;
    label: string;
    description: string;
    icon: any;
    recommendations: string[];
}

const TASKS: MaintenanceTask[] = [
    {
        id: 'free_ram',
        label: 'Free Up RAM',
        description: "Quite often your Mac's memory gets fully filled. This makes your apps and open files feel pretty slow to get going. CleanMyMac helps your system push all of the unused bits out of the memory, thus making room for the stuff you need at hand.",
        icon: MemoryStick,
        recommendations: [
            'Your system feels too slow',
            'Need to open a heavy application or file'
        ]
    },
    {
        id: 'purgeable_space',
        label: 'Free Up Purgeable Space',
        description: 'Remove locally stored data that can be automatically regenerated or downloaded again by the system.',
        icon: HardDrive,
        recommendations: [
            'You are running low on disk space',
            'System implies "Disk is full" warnings'
        ]
    },
    {
        id: 'maintenance_scripts',
        label: 'Run Maintenance Scripts',
        description: 'Initiate standard UNIX maintenance scripts to rotate logs, remove temporary items, and reorganize system libraries.',
        icon: FileCode,
        recommendations: [
            'System behavior is inconsistent',
            'Application logs are taking up space'
        ]
    },
    {
        id: 'flush_dns',
        label: 'Flush DNS Cache',
        description: 'Resolve network connectivity issues by clearing stale DNS entries that may point to incorrect IP addresses.',
        icon: Globe,
        recommendations: [
            'Websites are not loading correctly',
            'Internet connection feels unstable'
        ]
    },
    {
        id: 'speed_mail',
        label: 'Speed Up Mail',
        description: 'Reindex the Mail app database to improve search speed and overall responsiveness of the application.',
        icon: Mail,
        recommendations: [
            'Mail search is slow or returns incomplete results',
            'Mail app feels sluggish'
        ]
    },
    {
        id: 'reindex_spotlight',
        label: 'Reindex Spotlight',
        description: 'Force a complete reindexing of the Spotlight database to fix search issues and missing file results.',
        icon: Search,
        recommendations: [
            'Spotlight search is not finding files',
            'Applications are not showing up in search'
        ]
    },
    {
        id: 'repair_permissions',
        label: 'Repair Disk Permissions',
        description: 'Verify and repair file permissions to ensure that the system can access files correctly.',
        icon: ShieldCheck,
        recommendations: [
            'Apps are crashing or failing to launch',
            'Files are not accessible'
        ]
    },
    {
        id: 'time_machine',
        label: 'Time Machine Snapshot Thinning',
        description: 'Reduce the size of Time Machine local snapshots to reclaim space on your startup disk.',
        icon: History,
        recommendations: [
            'Backups are taking too much space',
            'Preparing backup takes too long'
        ]
    }
];

export function Maintenance() {
    const { call } = useTauri();
    const [selectedTaskId, setSelectedTaskId] = useState<string>(TASKS[0].id);
    const [runningTask, setRunningTask] = useState<string | null>(null);
    const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

    const selectedTask = useMemo(() => TASKS.find(t => t.id === selectedTaskId), [selectedTaskId]);

    const runTask = async () => {
        if (!selectedTask || runningTask) return;

        setRunningTask(selectedTask.id);
        try {
            // Mock delay for visual effect since some tasks are instant
            await new Promise(r => setTimeout(r, 1500));

            await call<SpeedTaskResult>('run_speed_task_command', { taskId: selectedTask.id });
            setCompletedTasks(prev => new Set(prev).add(selectedTask.id));
            playCompletionSound();
        } catch (e) {
            console.error(e);
        } finally {
            setRunningTask(null);
        }
    };

    return (
        <div className="h-full w-full bg-transparent text-white flex flex-col font-sans overflow-hidden relative">
            {/* Background Accents to match screenshot (soft pink/purple glow) */}
            <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-pink-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-900/40 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="h-14 flex items-center justify-between px-6 shrink-0 z-20">
                <div className="flex items-center gap-2 text-white/50 text-sm">
                    <span>‹</span>
                    <span>Intro</span>
                </div>
                <div className="text-white/30 text-xs font-medium uppercase tracking-wider">Maintenance</div>
                <div className="flex items-center gap-2">
                    <button className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium border border-white/5 transition-colors flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        Assistant
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden z-10 px-8 pb-8 gap-12">
                {/* Left Panel: Task List */}
                <div className="w-[420px] flex flex-col pt-4">
                    <div className="space-y-1">
                        {TASKS.map(task => {
                            const isSelected = selectedTaskId === task.id;
                            const isDone = completedTasks.has(task.id);
                            const Icon = task.icon;

                            return (
                                <button
                                    key={task.id}
                                    onClick={() => setSelectedTaskId(task.id)}
                                    className={`group w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-left relative overflow-hidden ${isSelected
                                        ? 'bg-white/10 shadow-lg backdrop-blur-md'
                                        : 'hover:bg-white/5'
                                        }`}
                                >
                                    {/* Radio / Status Indicator */}
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${isSelected
                                        ? 'border-white bg-white/20'
                                        : isDone
                                            ? 'border-emerald-400 bg-emerald-400/20'
                                            : 'border-white/30 group-hover:border-white/50'
                                        }`}>
                                        {isDone && <CheckCircle2 size={12} className="text-emerald-400" />}
                                        {isSelected && !isDone && <div className="w-2 h-2 rounded-full bg-white" />}
                                    </div>

                                    {/* Icon Box */}
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-blue-500 shadow-md' : 'bg-white/10'
                                        }`}>
                                        <Icon size={20} className="text-white" />
                                    </div>

                                    {/* Label */}
                                    <span className={`font-medium text-[15px] ${isSelected ? 'text-white' : 'text-white/80'}`}>
                                        {task.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Details */}
                <div className="flex-1 flex flex-col pt-8 pr-12 relative">
                    <AnimatePresence mode="wait">
                        {selectedTask && (
                            <motion.div
                                key={selectedTask.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1"
                            >
                                <h1 className="text-4xl font-bold mb-6 text-white">{selectedTask.label}</h1>
                                <p className="text-lg text-white/70 leading-relaxed mb-12 max-w-xl">
                                    {selectedTask.description}
                                </p>

                                <div className="mb-8">
                                    <h3 className="text-white/40 text-sm uppercase tracking-wider font-semibold mb-4">
                                        Usage recommendations:
                                    </h3>
                                    <ul className="space-y-3">
                                        {selectedTask.recommendations.map((rec, i) => (
                                            <li key={i} className="flex items-start gap-3 text-white/80">
                                                <div className="w-1.5 h-1.5 rounded-full bg-white/40 mt-2 shrink-0" />
                                                <span className="text-base">{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Footer Info */}
                    <div className="absolute bottom-4 right-0 text-white/30 text-xs text-right">
                        Last run date: 16 Feb, 2026 at 1:58 PM
                    </div>

                    {/* Floating Action Button - Center Bottom of Context */}
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
                            {/* Outer Glow Ring */}
                            <div className="absolute inset-0 rounded-full border-[6px] border-[#3E2348] opacity-80" />

                            {/* Inner Circle */}
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
