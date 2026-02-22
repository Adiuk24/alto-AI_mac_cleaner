import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { aiService, type ActionResult } from '../services/aiService';
import { SystemOverviewWidget } from '../components/chat/SystemOverviewWidget';
import { ThinkingIndicator } from '../components/chat/ThinkingIndicator';
import { ToolStatus } from '../components/chat/ToolStatus';
import { SuggestionChips } from '../components/chat/SuggestionChips';
import { AltoAvatar } from '../components/AltoAvatar';
import { DeleteConfirmCard, type IndexedFile } from '../components/chat/DeleteConfirmCard';
import { RichResultCard } from '../components/chat/RichResultCard';
import { ActionChips } from '../components/chat/ActionChips';
import { AVAILABLE_MENTIONS, MentionList } from '../components/chat/MentionList';
import { useScanStore } from '../store/scanStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from '../components/Button';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    actionResult?: ActionResult;
    widgetType?: 'overview' | 'delete_confirm' | 'rich_preview' | null;
    deletePreview?: IndexedFile[];
    richPreviewData?: { items: any[], totalSize: number, title: string };
    isStreaming?: boolean;
}

interface DeepScanEntry {
    directory: string;
    filesFound: number;
    sizeBytes: number;
    percent: number;
}

interface DeepScanState {
    active: boolean;
    entries: DeepScanEntry[];
    complete: boolean;
    totalFiles: number;
    totalBytes: number;
    topCategories: [string, number][];
    durationSecs: number;
}

interface AssistantProps {
    onNavigate: (tab: string) => void;
}

/** Converts a real ActionResult into plain text that the AI can use to write a genuine summary */
function buildRealResultSummary(result: ActionResult): string {
    const d = result.data;
    if (!d) return result.summary || 'Task completed.';

    switch (result.action) {
        case 'scan_junk': {
            const totalBytes = d.total_size_bytes ?? 0;
            const count = d.items?.length ?? 0;
            const mb = (totalBytes / 1024 / 1024).toFixed(1);
            return `Junk scan complete. Found ${count} junk items totalling ${mb} MB. ` +
                (count > 0 ? `Top items: ${d.items?.slice(0, 3).map((i: any) => i.path?.split('/').pop()).join(', ')}.` : 'System is clean.');
        }
        case 'clean_junk': {
            const removed = d.removed ?? 0;
            const errors = d.errors?.length ?? 0;
            return `Cleaned ${removed} items. ` + (errors > 0 ? `${errors} items could not be deleted (permissions or locked files).` : 'No errors.');
        }
        case 'scan_malware': {
            const threats: string[] = d.threats_found ?? [];
            if (threats.length === 0) return 'Malware scan complete. Zero threats detected. System is clean.';
            return `Malware scan complete. ${threats.length} threat(s) found: ${threats.join(', ')}.`;
        }
        case 'optimize_speed': {
            const dns = d.dns?.status ?? 'unknown';
            const ram = d.ram?.status ?? 'unknown';
            return `Speed optimization done. DNS flush: ${dns}. RAM cleanup: ${ram}.`;
        }
        case 'scan_large_files':
        case 'scan_heavy_files': {
            const count = d.itemCount ?? 0;
            const mb = ((d.totalSize ?? 0) / 1024 / 1024).toFixed(1);
            return `Large files scan complete. Found ${count} files totalling ${mb} MB.`;
        }
        default:
            return result.summary || 'Task completed successfully.';
    }
}



export function Assistant({ onNavigate }: AssistantProps) {
    const { systemStats, junkResult } = useScanStore();
    const [input, setInput] = useState('');
    const CHAT_HISTORY_KEY = 'alto_chat_history_v1';

    // Load user profile for personalized greeting
    const savedProfile = localStorage.getItem('alto_user_profile_v1');
    const userName = savedProfile ? JSON.parse(savedProfile).name : '';
    const greeting = userName
        ? `Hello, **${userName}!** I'm **Alto**, your intelligent system agent. \n\nI can help you scan for junk, detect malware, or optimize your system performance. What's on your mind?`
        : `Hello! I'm **Alto**, your intelligent system agent. \n\nI can help you scan for junk, detect malware, or optimize your system performance. What's on your mind?`;

    const defaultMessages: Message[] = [{
        id: '1',
        role: 'assistant',
        text: greeting,
        timestamp: new Date()
    }];

    // Load persisted chat history from localStorage
    const loadHistory = (): Message[] => {
        try {
            const raw = localStorage.getItem(CHAT_HISTORY_KEY);
            if (!raw) return defaultMessages;
            const parsed: Message[] = JSON.parse(raw);
            if (!Array.isArray(parsed) || parsed.length === 0) return defaultMessages;
            // Restore Date objects
            return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
        } catch {
            return defaultMessages;
        }
    };

    const [messages, setMessages] = useState<Message[]>(loadHistory);
    const [isThinking, setIsThinking] = useState(false);
    const [thinkingStatus, setThinkingStatus] = useState<string>('');
    const [liveSteps, setLiveSteps] = useState<string[]>([]);
    const [isExecutingAction, setIsExecutingAction] = useState(false);
    const [deepScan, setDeepScan] = useState<DeepScanState>({
        active: false, entries: [], complete: false,
        totalFiles: 0, totalBytes: 0, topCategories: [], durationSecs: 0
    });

    // Mention State
    const [mentionVisible, setMentionVisible] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);

    const filteredMentions = AVAILABLE_MENTIONS.filter(m =>
        m.label.toLowerCase().includes(mentionFilter.toLowerCase())
    );

    const selectMention = (index: number) => {
        if (index >= filteredMentions.length) return;
        const option = filteredMentions[index];

        const lastAt = input.lastIndexOf('@');
        if (lastAt !== -1) {
            const prefix = input.slice(0, lastAt);
            const newValue = `${prefix}@${option.label} `; // Add space after
            setInput(newValue);
            setMentionVisible(false);
            // Restore focus
            textareaRef.current?.focus();
        }
    };

    // Persist chat history whenever messages change
    useEffect(() => {
        const toSave = messages.slice(-50);
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave));
    }, [messages]);

    // On mount: load MCP context store so AI knows history, then listen for live events
    useEffect(() => {
        // Load MCP context and cache for AI
        invoke<Record<string, unknown>>('get_mcp_context').then(ctx => {
            localStorage.setItem('alto_context_store_cache', JSON.stringify(ctx));
        }).catch(() => { });

        // Listen for live system events from the watcher (app installs, downloads)
        const unlisten = listen<{ name: string; path: string; event_type: string }>('system-event', (evt) => {
            const { name, event_type } = evt.payload;

            let alertText = '';
            if (event_type === 'app_installed') {
                alertText = `🆕 I noticed **${name}** was just installed on your Mac. Want me to scan it for junk leftovers or security issues?`;
            } else if (event_type === 'suspicious_download') {
                alertText = `⚠️ I spotted a potentially suspicious file in your Downloads: **${name}**. It's an executable type — want me to run a quick malware check?`;
            } else if (event_type === 'file_downloaded') {
                alertText = `📥 New file in Downloads: **${name}**. Let me know if you'd like me to check it.`;
            }

            if (alertText) {
                const alertMsg: Message = {
                    id: `sys-${Date.now()}`,
                    role: 'assistant',
                    text: alertText,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, alertMsg]);

                // Also refresh MCP context cache
                invoke<Record<string, unknown>>('get_mcp_context').then(ctx => {
                    localStorage.setItem('alto_context_store_cache', JSON.stringify(ctx));
                }).catch(() => { });
            }
        });

        // Listen for deep scan progress events from background Rust task
        const unlistenDeepProgress = listen<{ directory: string; files_found: number; size_bytes: number; percent: number }>('deep-scan-progress', (evt) => {
            const { directory, files_found, size_bytes, percent } = evt.payload;
            setDeepScan(prev => ({
                ...prev,
                active: true,
                entries: [...prev.entries, { directory, filesFound: files_found, sizeBytes: size_bytes, percent }]
            }));
            // Auto-scroll
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        });

        // Listen for deep scan completion
        const unlistenDeepComplete = listen<{ total_files: number; total_size_bytes: number; top_categories: [string, number][]; duration_secs: number }>('deep-scan-complete', (evt) => {
            const { total_files, total_size_bytes, top_categories, duration_secs } = evt.payload;
            setDeepScan(prev => ({
                ...prev,
                active: false,
                complete: true,
                totalFiles: total_files,
                totalBytes: total_size_bytes,
                topCategories: top_categories,
                durationSecs: duration_secs
            }));
            // Inject a final summary message from Alto
            const summary = `✅ **Deep Scan Complete** (${duration_secs.toFixed(0)}s)

Scanned **${total_files.toLocaleString()} files** totalling **${(total_size_bytes / 1024 / 1024 / 1024).toFixed(2)} GB**.

Top areas by size:
${top_categories.slice(0, 5).map(([cat, bytes]) => `• **${cat}**: ${(bytes / 1024 / 1024).toFixed(0)} MB`).join('\n')}

Would you like me to clean any of these? Just say the word.`;
            setMessages(prev => [...prev, {
                id: `deep-done-${Date.now()}`,
                role: 'assistant',
                text: summary,
                timestamp: new Date(),
            }]);
        });

        return () => {
            unlisten.then(fn => fn());
            unlistenDeepProgress.then(fn => fn());
            unlistenDeepComplete.then(fn => fn());
        };
    }, []);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [input]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isThinking]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const streamResponse = async (fullText: string, messageId: string) => {
        const words = fullText.split(' ');
        let currentText = '';

        for (let i = 0; i < words.length; i++) {
            currentText += words[i] + ' ';
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, text: currentText, isStreaming: true } : msg
            ));
            // Random delay for natural typing feel
            await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 10));
        }

        setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, isStreaming: false } : msg
        ));
    };

    const handleSend = async (text: string = input) => {
        if (!text.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: text,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsThinking(true);
        setLiveSteps([]);
        setIsExecutingAction(false);
        setThinkingStatus('Consulting neural engine...');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        // Register live step callback so Alto's work is visible in real-time
        aiService.setStepCallback((step: string) => {
            setIsExecutingAction(true);
            setIsThinking(false);
            setLiveSteps(prev => [...prev, step]);
        });

        try {
            // Phase 1: Ask AI what it wants to do
            const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.text }));
            const response = await aiService.chat(apiMessages);
            aiService.clearStepCallback();

            setIsThinking(false);
            setIsExecutingAction(false);
            setThinkingStatus('');

            // Phase 2: If an action was triggered, execute it and report real results
            if (response.actionResult) {
                // Navigate immediately — no real result needed
                if (response.actionResult.action.startsWith('navigate:')) {
                    const target = response.actionResult.action.split(':')[1];
                    if (target) onNavigate(target);
                }

                // MCP Safety: For any destructive action that returns items, show Confirm Card first
                const destructiveActions = ['clean_junk', 'empty_trash', 'clean_mail', 'clean_privacy'];
                if (destructiveActions.includes(response.actionResult.action) && response.actionResult.data?.items) {
                    const paths: string[] = response.actionResult.data.items.map((item: any) => item.path);
                    const preview = await invoke<IndexedFile[]>('preview_delete', { paths });
                    const aiMsgId = (Date.now() + 1).toString();
                    const aiMsg: Message = {
                        id: aiMsgId,
                        role: 'assistant',
                        text: response.text, // Show AI's intent text immediately
                        timestamp: new Date(),
                        actionResult: response.actionResult,
                        widgetType: 'delete_confirm',
                        deletePreview: preview
                    };
                    setMessages(prev => [...prev, aiMsg]);
                    return;
                }

                // For all other actions: get REAL results and ask AI to summarize them
                const realResult = response.actionResult;
                const aiMsgId = (Date.now() + 1).toString();

                let widgetType: 'overview' | 'delete_confirm' | 'rich_preview' | null = null;
                let richPreviewData = undefined;

                if (realResult.action === 'show_overview') {
                    widgetType = 'overview';
                } else if (realResult.action === 'scan_junk' || realResult.action === 'scan_large_files') {
                    widgetType = 'rich_preview';
                    richPreviewData = {
                        items: realResult.data?.items || [],
                        totalSize: realResult.data?.total_size_bytes || 0,
                        title: realResult.action === 'scan_junk' ? 'Junk Scan Results' : 'Large Files Discovered'
                    };
                }

                // Show placeholder with initial AI intent while generating real summary
                setMessages(prev => [...prev, {
                    id: aiMsgId,
                    role: 'assistant',
                    text: response.text, // Fix: Show intent text instead of empty string
                    timestamp: new Date(),
                    actionResult: realResult,
                    widgetType,
                    richPreviewData
                }]);

                // Phase 3: Feed REAL results back to AI for a genuine response
                const realSummaryText = buildRealResultSummary(realResult);
                const followupMessages = [
                    ...apiMessages,
                    { role: 'assistant', content: response.text }, // AI's intent
                    { role: 'user', content: `SYSTEM: The task completed. Here are the REAL results:\n${realSummaryText}\n\nNow write a concise, friendly 2-3 sentence summary of what actually happened using these exact numbers. \n\n⚠️ CRITICAL: DO NOT output any ACTION tags or mention "scanning" in a way that sounds like a new command. Just summarize the results.` }
                ];

                setIsThinking(true);
                setThinkingStatus(`Synthesizing ${realResult.action} results...`);
                const realResponse = await aiService.chat(followupMessages);
                setIsThinking(false);
                setThinkingStatus('');

                await streamResponse(realResponse.text, aiMsgId);
                return;
            }

            // No action — just stream the AI's regular text response
            const aiMsgId = (Date.now() + 1).toString();
            setMessages(prev => [...prev, {
                id: aiMsgId,
                role: 'assistant',
                text: '',
                timestamp: new Date()
            }]);
            await streamResponse(response.text, aiMsgId);

        } catch (error: any) {
            console.error(error);
            setIsThinking(false);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: `**System Error**: ${error.message || 'Unknown error occurred.'}`,
                timestamp: new Date()
            }]);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (mentionVisible && filteredMentions.length > 0) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => Math.max(0, prev - 1));
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => Math.min(filteredMentions.length - 1, prev + 1));
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                selectMention(mentionIndex);
                return;
            }
            if (e.key === 'Escape') {
                setMentionVisible(false);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const [isTyping, setIsTyping] = useState(false);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setInput(val);
        setIsTyping(val.length > 0); // Activate "Alive" state

        // Check for @ trigger
        const cursorInfo = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursorInfo);
        const lastAt = textBeforeCursor.lastIndexOf('@');

        if (lastAt !== -1) {
            const textAfterAt = textBeforeCursor.slice(lastAt + 1);
            if (!textAfterAt.includes(' ')) {
                setMentionVisible(true);
                setMentionFilter(textAfterAt);
                setMentionIndex(0);
                return;
            }
        }
        setMentionVisible(false);
    };

    return (
        <div className="h-full flex flex-col relative font-sans">
            {/* Header - Transparent/Glass */}
            <div className="absolute top-0 left-0 right-0 z-10 p-6 flex justify-between items-start pointer-events-none">
                <header className="mb-6 flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl shadow-purple-500/10 transition-transform duration-500 hover:scale-105 pointer-events-auto">
                        <AltoAvatar size={42} isThinking={isThinking} isTyping={isTyping} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight leading-none drop-shadow-md">Alto AI</h1>
                        <p className="text-xs text-white/50 font-medium tracking-wide mt-1">Agentic System &bull; v2.0</p>
                    </div>
                </header>
            </div>

            {/* Chat Area - Professional conversation panel */}
            <div className="flex-1 overflow-y-auto px-4 md:px-12 lg:px-16 pt-28 pb-48 scroll-smooth no-scrollbar">
                <div className="max-w-4xl mx-auto">
                    {/* Contained conversation surface - pro dashboard feel */}
                    <div className="min-h-[60vh] rounded-2xl border border-white/[0.06] bg-white/[0.02] shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] px-6 md:px-10 py-8 md:py-10">
                        <div className="space-y-10 max-w-3xl mx-auto">
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 16, scale: 0.99 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                                    className={cn(
                                        "flex gap-4",
                                        msg.role === 'user' ? 'flex-row-reverse' : ''
                                    )}
                                >
                                    {/* Avatar for Assistant */}
                                    {msg.role === 'assistant' && (
                                        <div className="shrink-0 pt-0.5">
                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/25 to-purple-500/15 flex items-center justify-center border border-white/10 shadow-sm">
                                                <Sparkles size={16} className="text-indigo-300/90" />
                                            </div>
                                        </div>
                                    )}
                                    {msg.role === 'user' && (
                                        <div className="shrink-0 pt-0.5 w-9 h-9 rounded-xl bg-primary/20 border border-primary/20 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">You</span>
                                        </div>
                                    )}

                                    <div className={cn(
                                        "flex flex-col min-w-0 flex-1",
                                        msg.role === 'user' ? 'items-end' : 'items-start'
                                    )}>

                                        {/* Optional label for assistant */}
                                        {msg.role === 'assistant' && (
                                            <span className="text-[11px] font-medium text-white/40 tracking-wide mb-1.5 uppercase">Alto</span>
                                        )}

                                        {/* Tool Execution Steps (Agentic) */}
                                        {msg.role === 'assistant' && msg.actionResult?.steps && (
                                            <div className="mb-3 w-full">
                                                <AnimatePresence>
                                                    {msg.actionResult.steps.map((step, idx) => (
                                                        <motion.div
                                                            key={idx}
                                                            initial={{ opacity: 0, x: -8 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: idx * 0.18, type: 'spring', stiffness: 400, damping: 30 }}
                                                        >
                                                            <ToolStatus
                                                                toolName={msg.actionResult!.action}
                                                                label={step}
                                                                state={'completed'}
                                                            />
                                                        </motion.div>
                                                    ))}
                                                </AnimatePresence>
                                            </div>
                                        )}

                                        {/* Message bubble - professional card style */}
                                        <div className={cn(
                                            "rounded-2xl text-[15px] leading-[1.65] relative max-w-[90%] md:max-w-[85%]",
                                            msg.role === 'user'
                                                ? "px-5 py-3.5 bg-primary text-white shadow-lg shadow-primary/25 border border-white/10 rounded-tr-md"
                                                : "px-5 py-4 rounded-tl-md glass-frost text-white/95 border border-white/[0.06] shadow-sm"
                                        )}>
                                            {msg.role === 'user' ? (
                                                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                                            ) : (
                                                <div className="chat-prose markdown-body [&_strong]:font-semibold [&_strong]:text-white [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:pl-5 [&_li]:mb-0.5 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-white/10 [&_code]:text-[14px] [&_pre]:my-3 [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:bg-black/30 [&_pre]:overflow-x-auto">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {msg.text}
                                                    </ReactMarkdown>
                                                </div>
                                            )}
                                            {msg.role === 'assistant' && (
                                                <Sparkles className="absolute top-3 right-3 w-3.5 h-3.5 text-primary/50" aria-hidden />
                                            )}
                                        </div>

                                {/* Interactive Widgets */}
                                {msg.widgetType === 'overview' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-4 w-full"
                                    >
                                        <SystemOverviewWidget
                                            stats={systemStats}
                                            junkSize={junkResult?.total_size_bytes || 0}
                                            onClean={() => onNavigate('system-junk')}
                                            onNavigate={onNavigate}
                                        />
                                    </motion.div>
                                )}

                                {msg.widgetType === 'delete_confirm' && msg.deletePreview && (
                                    <div className="mt-4 w-full">
                                        <DeleteConfirmCard
                                            files={msg.deletePreview}
                                            onConfirm={async (safePaths) => {
                                                // ... (Handlers kept same)
                                                try {
                                                    const result = await invoke<any>('confirm_delete', { paths: safePaths });
                                                    setMessages(prev => prev.map(m => m.id === msg.id ? {
                                                        ...m, widgetType: null, text: m.text + `\n\n✅ **Done!** Removed ${result.removed} files.`
                                                    } : m));
                                                } catch (e: unknown) {
                                                    const errMsg = e instanceof Error ? e.message : 'Delete failed';
                                                    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, widgetType: null, text: m.text + `\n\n❌ **Error:** ${errMsg}` } : m));
                                                }
                                            }}
                                            onCancel={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, widgetType: null, text: m.text + '\n\n🚫 Cleanup cancelled.' } : m))}
                                        />
                                    </div>
                                )}

                                {msg.widgetType === 'rich_preview' && msg.richPreviewData && (
                                    <div className="mt-4 w-full">
                                        <RichResultCard
                                            items={msg.richPreviewData.items}
                                            totalSize={msg.richPreviewData.totalSize}
                                            title={msg.richPreviewData.title}
                                            onViewItem={(path) => handleSend(`Tell me more about this file: ${path}`)}
                                        />
                                    </div>
                                )}

                                {msg.role === 'assistant' && msg.actionResult?.data?.suggestions && (
                                    <ActionChips
                                        chips={msg.actionResult.data.suggestions}
                                        onAction={(action) => action.startsWith('navigate:') ? onNavigate(action.split(':')[1]) : handleSend(action)}
                                    />
                                )}
                            </div>
                        </motion.div>
                    ))}

                    {/* Deep Scan Live Progress Card */}
                    <AnimatePresence>
                        {(deepScan.active || deepScan.complete) && deepScan.entries.length > 0 && (
                            <motion.div
                                key="deep-scan-card"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex gap-5 justify-start"
                            >
                                <div className="mt-1 shrink-0">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/10 flex items-center justify-center border border-white/5">
                                        <Sparkles size={14} className="text-purple-300" />
                                    </div>
                                </div>
                                <div className="flex-1 max-w-lg">
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                                        {/* Header */}
                                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                                            <div className="flex items-center gap-2">
                                                {deepScan.active ? (
                                                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                                                ) : (
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                                )}
                                                <span className="text-xs font-mono text-white/60 tracking-wider uppercase">
                                                    {deepScan.active ? 'Deep Scan Running' : `Deep Scan Complete — ${deepScan.durationSecs.toFixed(0)}s`}
                                                </span>
                                            </div>
                                            {deepScan.active && (
                                                <span className="text-[10px] text-purple-300/70 font-mono">
                                                    {deepScan.entries[deepScan.entries.length - 1]?.percent ?? 0}%
                                                </span>
                                            )}
                                        </div>
                                        {/* Progress bar */}
                                        {deepScan.active && (
                                            <div className="h-0.5 bg-white/5">
                                                <motion.div
                                                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-400"
                                                    animate={{ width: `${deepScan.entries[deepScan.entries.length - 1]?.percent ?? 0}%` }}
                                                    transition={{ duration: 0.4 }}
                                                />
                                            </div>
                                        )}
                                        {/* Per-directory entries */}
                                        <div className="max-h-48 overflow-y-auto px-4 py-2 space-y-0.5">
                                            {deepScan.entries.map((entry, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, x: -6 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0"
                                                >
                                                    <span className="text-xs text-white/70 font-mono flex items-center gap-2">
                                                        {idx === deepScan.entries.length - 1 && deepScan.active ? (
                                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
                                                        ) : (
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 shrink-0" />
                                                        )}
                                                        {entry.directory}
                                                    </span>
                                                    <div className="flex items-center gap-2 ml-4 shrink-0">
                                                        <span className="text-[10px] text-white/40">{entry.filesFound.toLocaleString()} files</span>
                                                        <span className="text-[10px] font-mono text-purple-300/80">
                                                            {entry.sizeBytes > 1024 * 1024 * 1024
                                                                ? `${(entry.sizeBytes / 1024 / 1024 / 1024).toFixed(1)} GB`
                                                                : `${(entry.sizeBytes / 1024 / 1024).toFixed(0)} MB`}
                                                        </span>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Live Execution Panel — shows Alto working in real-time */}
                    <AnimatePresence>
                        {isExecutingAction && liveSteps.length > 0 && (
                            <motion.div
                                key="live-execution"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="flex gap-5 justify-start"
                            >
                                {/* Alto avatar */}
                                <div className="mt-1 shrink-0">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/10 flex items-center justify-center border border-white/5 shadow-inner">
                                        <Sparkles size={14} className="text-indigo-300" />
                                    </div>
                                </div>
                                <div className="flex flex-col items-start">
                                    <p className="text-[11px] font-mono text-white/30 mb-2 tracking-widest uppercase">Alto is working</p>
                                    {liveSteps.map((step, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                        >
                                            <ToolStatus
                                                toolName={step}
                                                label={step}
                                                state={idx === liveSteps.length - 1 ? 'running' : 'completed'}
                                            />
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isThinking && <ThinkingIndicator status={thinkingStatus} />}
                    <div ref={messagesEndRef} className="h-4" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Command Capsule - The New "Centerpiece" Input */}
            <div className="absolute bottom-8 left-0 right-0 px-4 flex justify-center z-50 pointer-events-none">
                <div className="relative w-full max-w-2xl pointer-events-auto group">

                    {/* Suggestion Chips - Float Above */}
                    <AnimatePresence>
                        {messages.length < 3 && !isThinking && !input.trim() && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                className="absolute -top-16 left-0 right-0 flex justify-center"
                            >
                                <SuggestionChips onSelect={(text) => handleSend(text)} />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* The Capsule Itself */}
                    <motion.div
                        layout
                        className={cn(
                            "relative bg-black/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-2 flex items-end gap-3 shadow-2xl shadow-black/60",
                            "transition-all duration-500 ring-1",
                            isTyping ? "ring-primary/40 border-primary/20 bg-black/60" : "ring-white/5 hover:ring-white/10"
                        )}
                    >
                        {/* Inner "Neural Activity" Glow */}
                        <AnimatePresence>
                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/10 via-transparent to-primary/10 pointer-events-none"
                                />
                            )}
                        </AnimatePresence>

                        <MentionList
                            visible={mentionVisible}
                            filter={mentionFilter}
                            selectedIndex={mentionIndex}
                            onSelect={(opt) => selectMention(filteredMentions.findIndex(m => m.id === opt.id))}
                            position={{ x: 20, y: -200 }} // Float above
                        />

                        {/* Input Field */}
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsTyping(true)}
                            onBlur={() => setIsTyping(false)}
                            placeholder="Ask Alto to scan, clean, or explain..."
                            className="w-full bg-transparent text-white placeholder:text-white/20 text-[15.5px] px-4 py-3 min-h-[50px] max-h-[160px] resize-none focus:outline-none scrollbar-hide font-medium tracking-wide"
                            rows={1}
                        />

                        {/* Action Button - Custom Premium Button */}
                        <Button
                            variant={input.trim() ? "primary" : "secondary"}
                            size="icon"
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isThinking}
                            className="h-11 w-11 min-w-[44px] rounded-2xl mb-1 mr-1 shadow-none"
                        >
                            {isThinking ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <ArrowUp size={20} strokeWidth={3} />
                            )}
                        </Button>
                    </motion.div>

                    {/* Footer Hint */}
                    <p className="text-center text-[10px] text-white/20 mt-3 font-medium tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        Agentic Mode Active &bull; v2.1.4
                    </p>
                </div>
            </div>
        </div>
    );
}
