import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ScanResult, AIInsight, SystemStats } from '../types';
import { analyzeScanResults } from '../utils/aiLogic';

interface ScanState {
    junkResult: ScanResult | null;
    largeFilesResult: ScanResult | null;

    isScanningJunk: boolean;
    isScanningLargeFiles: boolean;

    startJunkScan: () => void;
    finishJunkScan: (result: ScanResult) => void;

    startLargeFilesScan: () => void;
    finishLargeFilesScan: (result: ScanResult) => void;

    // Selection State
    selectedJunkItems: Set<string>;
    toggleJunkItem: (path: string) => void;
    setAllJunkItems: (paths: Set<string>) => void;

    // AI State
    aiInsight: AIInsight | null;
    isGeneratingInsight: boolean;
    generateInsight: () => void;

    // Full Context Stats
    systemStats: SystemStats | null;
    installedAppsCount: number;
    fetchSystemStats: () => Promise<void>;
    fetchAppStats: () => Promise<void>;

    reset: () => void;
}

export const useScanStore = create<ScanState>((set, get) => ({
    // ... existing ...
    junkResult: null,
    largeFilesResult: null,
    isScanningJunk: false,
    isScanningLargeFiles: false,
    selectedJunkItems: new Set(),

    aiInsight: null,
    isGeneratingInsight: false,

    systemStats: null,
    installedAppsCount: 0,



    // ... existing start/finish ...
    startJunkScan: () => set({ isScanningJunk: true }),
    finishJunkScan: (result) => {
        // Auto-select all items by default
        const allPaths = new Set(result.items.map(i => i.path));
        set({
            junkResult: result,
            isScanningJunk: false,
            selectedJunkItems: allPaths
        });
    },

    startLargeFilesScan: () => set({ isScanningLargeFiles: true }),
    finishLargeFilesScan: (result) => set({ largeFilesResult: result, isScanningLargeFiles: false }),

    toggleJunkItem: (path) => set((state) => {
        const next = new Set(state.selectedJunkItems);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return { selectedJunkItems: next };
    }),

    setAllJunkItems: (paths) => set({ selectedJunkItems: paths }),

    generateInsight: () => {
        set({ isGeneratingInsight: true });
        // Simulate AI thinking delay
        setTimeout(() => {
            const { junkResult, largeFilesResult } = get();
            const insight = analyzeScanResults(junkResult, largeFilesResult);
            set({ aiInsight: insight, isGeneratingInsight: false });
        }, 1500);
    },

    fetchSystemStats: async () => {
        try {
            const stats = await invoke<SystemStats>('get_system_stats_command');
            set({ systemStats: stats });
        } catch (e) {
            console.error("Failed to fetch system stats", e);
        }
    },

    fetchAppStats: async () => {
        try {
            const apps = await invoke<any[]>('scan_apps_command');
            set({ installedAppsCount: apps.length });
        } catch (e) {
            console.error("Failed to fetch apps", e);
        }
    },

    reset: () => set({
        junkResult: null,
        largeFilesResult: null,
        isScanningJunk: false,
        isScanningLargeFiles: false,
        selectedJunkItems: new Set(),
        aiInsight: null,
        isGeneratingInsight: false,
        systemStats: null,
        installedAppsCount: 0
    }),
}));
