import type { ScanResult, ScannedItem, AIInsight } from '../types';
import { formatBytes } from './formatBytes';

export function analyzeScanResults(junk: ScanResult | null, large: ScanResult | null): AIInsight {
    const junkSize = junk?.total_size_bytes || 0;
    const largeSize = large?.total_size_bytes || 0;
    const totalSize = junkSize + largeSize;

    // 1. Analyze Categories
    const categories = new Map<string, number>();

    // Helper to categorize by simple heuristics if category_name isn't granular enough
    const categorize = (item: ScannedItem) => {
        const path = item.path.toLowerCase();
        if (path.includes('xcode') || path.includes('deriveddata')) return 'Developer';
        if (path.includes('cache')) return 'System Cache';
        if (path.includes('downloads')) return 'Downloads';
        if (path.includes('.dmg') || path.includes('.iso')) return 'Installers';
        if (path.includes('.log')) return 'Logs';
        return 'General';
    };

    [...(junk?.items || []), ...(large?.items || [])].forEach(item => {
        const cat = categorize(item);
        categories.set(cat, (categories.get(cat) || 0) + item.size_bytes);
    });

    // Find top contributor
    let topCat = '';
    let topSize = 0;
    categories.forEach((size, cat) => {
        if (size > topSize) {
            topSize = size;
            topCat = cat;
        }
    });

    // 2. Generate Insight Text
    let summary = '';
    let detail = '';
    let action = '';

    if (totalSize === 0) {
        return {
            summary: "Your Mac is clean and optimized.",
            detail: "No significant clutter found.",
            action: "Keep up the good work!"
        };
    }

    // Dynamic Summary
    if (topCat === 'Developer') {
        summary = `I found customizable developer clutter (${formatBytes(topSize)}).`;
        detail = "Xcode DerivedData and build artifacts are consuming significant space. These can be safely rebuilt.";
        action = "Review Developer Files";
    } else if (topCat === 'Downloads') {
        summary = `Forgotten downloads are taking up ${formatBytes(topSize)}.`;
        detail = "Old user downloads often contain installers and duplicate files you no longer need.";
        action = "Review Downloads";
    } else if (topCat === 'System Cache') {
        summary = `System caches have accumulated ${formatBytes(topSize)}.`;
        detail = "Over time, apps leave behind temporary files that can slow down your system.";
        action = "Clean System Junk";
    } else if (largeSize > junkSize * 2) {
        summary = `A few large files are the main culprits.`;
        detail = `I found ${large?.items.length} files taking up ${formatBytes(largeSize)}. Archiving or deleting them is the fastest way to free space.`;
        action = "Review Large Files";
    } else {
        summary = `I found ${formatBytes(totalSize)} of unneeded clutter.`;
        detail = "A mix of system logs, caches, and old files is using your storage space.";
        action = "Smart Clean";
    }

    return { summary, detail, action };
}
