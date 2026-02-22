import { motion } from 'framer-motion';
import { HelpCircle, BookOpen, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const USER_GUIDE_URL = 'https://github.com/Adiuk24/alto-AI_mac_cleaner/blob/main/docs/User-Guide.md';

const SECTIONS: { id: string; title: string; icon: string; items: { issue: string; fix: string }[] }[] = [
    {
        id: 'smart-scan',
        title: 'Smart Scan & System Junk',
        icon: '🧹',
        items: [
            { issue: 'Scan seems stuck', fix: 'Scans can take 30–60 seconds. Wait; the app stays responsive. If it never finishes, restart Alto and try again.' },
            { issue: 'No junk found', fix: 'Your system may already be clean, or some folders are excluded. Try "Deep Scan" from Ask Alto.' },
            { issue: 'Permission denied or some items not deleted', fix: 'Close apps using those files (e.g. browsers). For system-wide clean, enter your password when prompted.' },
            { issue: "Don't want to delete something", fix: 'Uncheck items in the Confirm Delete card before confirming. Use Protected Paths in Settings if supported.' },
        ],
    },
    {
        id: 'uninstaller',
        title: 'Uninstaller',
        icon: '📦',
        items: [
            { issue: '"No applications found"', fix: 'On macOS, grant Full Disk Access: System Settings → Privacy & Security → Full Disk Access → add Alto. Restart Alto and open Uninstaller again.' },
            { issue: 'Back button does nothing', fix: 'Use the sidebar to open Smart Scan or Ask Alto. Back should return to the dashboard.' },
            { issue: 'Categories show 0', fix: 'All = total apps. Leftovers = apps with leftover files (expand an app with the chevron to scan).' },
            { issue: 'Uninstall fails', fix: 'Quit the app fully and try again. System apps cannot be uninstalled.' },
        ],
    },
    {
        id: 'large-files',
        title: 'Large & Old Files',
        icon: '📁',
        items: [
            { issue: 'Stuck on "Scanning drive..."', fix: 'Scan can take 30+ seconds. If stuck for minutes, restart Alto. The screen should then show results or an empty list.' },
            { issue: 'No files listed', fix: 'Only files ≥ 50 MB are included. You may have none, or the scan hit the time/file limit. Try again.' },
            { issue: 'Delete or move files', fix: 'Select items with checkboxes, then use Delete (Trash) or Move (choose destination).' },
        ],
    },
    {
        id: 'malware-privacy',
        title: 'Malware & Privacy',
        icon: '🛡️',
        items: [
            { issue: 'Malware scan finds nothing', fix: 'Usually means no threats detected. Scanner uses heuristics and known patterns.' },
            { issue: 'Possible false positive', fix: 'Review the path. Skip that item if unsure; use macOS security tools for a second opinion.' },
            { issue: 'Privacy scan/clean', fix: 'Review the list before confirming. Cleaning removes the selected sensitive data.' },
        ],
    },
    {
        id: 'maintenance',
        title: 'Maintenance',
        icon: '🔧',
        items: [
            { issue: 'Task failed or permission error', fix: 'Some tasks need administrator privileges. Enter your macOS password when prompted.' },
            { issue: 'Rebuild Launch Services', fix: 'Fixes "Open with" and app associations. Safe to run; password may be required.' },
        ],
    },
    {
        id: 'space-lens',
        title: 'Space Lens',
        icon: '📊',
        items: [
            { issue: 'Empty or small tree', fix: 'Check the path (e.g. home folder). Some system paths are restricted.' },
            { issue: 'Slow to load', fix: 'Large directories take longer. Depth and file limits prevent hanging.' },
        ],
    },
    {
        id: 'shredder',
        title: 'Shredder',
        icon: '🗑️',
        items: [
            { issue: 'What does Shredder do?', fix: 'Overwrites file content before deletion so recovery is much harder. Use for sensitive files only.' },
            { issue: 'Safe to use?', fix: 'Yes for files you choose. Never shred system files or active app data.' },
        ],
    },
    {
        id: 'assistant',
        title: 'Ask Alto / Assistant',
        icon: '🤖',
        items: [
            { issue: "Alto doesn't respond or is slow", fix: 'First reply can be slow (model loading or API). Check Settings → AI/LLM: local models need to load; cloud needs connection.' },
            { issue: 'Wrong or no action', fix: 'Phrase clearly: "Scan for junk", "Find large files", "Uninstall...", "Optimize".' },
        ],
    },
    {
        id: 'general',
        title: 'General',
        icon: '⚙️',
        items: [
            { issue: "App won't start", fix: 'Reinstall from the latest release. On macOS, allow in System Settings → Privacy & Security if blocked.' },
            { issue: 'No notifications', fix: 'Enable in Settings and in System Settings → Notifications → Alto.' },
            { issue: 'Where is my data?', fix: 'Stored locally. No cloud upload of your file list unless you use a cloud AI in Settings.' },
            { issue: 'macOS asks for Full Disk Access', fix: 'Required for Uninstaller and some scans. System Settings → Privacy & Security → Full Disk Access → add Alto.' },
        ],
    },
];

function Section({ section, defaultOpen }: { section: typeof SECTIONS[0]; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(!!defaultOpen);
    return (
        <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5 transition-colors"
            >
                <span className="text-lg">{section.icon}</span>
                <span className="font-semibold text-white flex-1">{section.title}</span>
                {open ? <ChevronDown size={18} className="text-white/50" /> : <ChevronRight size={18} className="text-white/50" />}
            </button>
            {open && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/10"
                >
                    <div className="p-4 pt-2 space-y-4">
                        {section.items.map((item, i) => (
                            <div key={i} className="space-y-1">
                                <div className="text-sm font-medium text-white/90">{item.issue}</div>
                                <div className="text-sm text-white/60 pl-2 border-l-2 border-primary/30">{item.fix}</div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
}

export function Help() {
    return (
        <div className="h-full overflow-y-auto bg-gradient-to-b from-transparent to-white/[0.02]">
            <div className="max-w-3xl mx-auto px-6 py-10 pb-24">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 rounded-xl bg-primary/20 border border-primary/30">
                        <HelpCircle size={24} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Help & Troubleshooting</h1>
                        <p className="text-sm text-white/50">Quick fixes and tips for Alto</p>
                    </div>
                </div>

                <p className="text-white/70 text-sm mb-8">
                    Use the sections below to find solutions. For the full guide (AI Assistant, MCP Safety, permissions), open the User Guide link at the bottom.
                </p>

                <div className="space-y-3">
                    {SECTIONS.map((section, i) => (
                        <Section key={section.id} section={section} defaultOpen={i === 0} />
                    ))}
                </div>

                <div className="mt-10 p-4 rounded-xl bg-white/5 border border-white/10 flex flex-wrap items-center gap-3">
                    <BookOpen size={18} className="text-primary shrink-0" />
                    <span className="text-sm text-white/80">Full User Guide (features, permissions, tips)</span>
                    <a
                        href={USER_GUIDE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                        Open on GitHub <ExternalLink size={14} />
                    </a>
                </div>
            </div>
        </div>
    );
}
