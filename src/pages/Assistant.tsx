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
import { MentionList, AVAILABLE_MENTIONS } from '../components/chat/MentionList';
import { useScanStore } from '../store/scanStore';

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

        return () => { unlisten.then(fn => fn()); };
    }, []);

    // Access store
    const { systemStats, junkResult } = useScanStore();
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
        setThinkingStatus('Consulting neural engine...');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        try {
            // Phase 1: Ask AI what it wants to do
            const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.text }));
            const response = await aiService.chat(apiMessages);

            setIsThinking(false);
            setThinkingStatus('');

            // Phase 2: If an action was triggered, execute it and report real results
            if (response.actionResult) {
                // Navigate immediately — no real result needed
                if (response.actionResult.action.startsWith('navigate:')) {
                    const target = response.actionResult.action.split(':')[1];
                    if (target) onNavigate(target);
                }

                // MCP Safety: For clean_junk, show Confirm Card first
                if (response.actionResult.action === 'clean_junk' && response.actionResult.data?.items) {
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

            {/* Chat Area - Premium Layout */}
            <div className="flex-1 overflow-y-auto px-4 md:px-20 pt-28 pb-48 scroll-smooth no-scrollbar">
                <div className="max-w-3xl mx-auto space-y-8">
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 20, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: "spring", stiffness: 350, damping: 25 }} // Physics bounce
                            className={`flex gap-5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {/* Avatar for Assistant - Floating Left */}
                            {msg.role === 'assistant' && (
                                <div className="mt-1 shrink-0">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/10 flex items-center justify-center border border-white/5 shadow-inner">
                                        <Sparkles size={14} className="text-indigo-300" />
                                    </div>
                                </div>
                            )}

                            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

                                {/* Tool Execution Steps (Agentic) - Clean Micro-UI */}
                                {msg.role === 'assistant' && msg.actionResult?.steps && (
                                    <div className="mb-3 space-y-2 w-full">
                                        {msg.actionResult.steps.map((_step, idx) => (
                                            <ToolStatus
                                                key={idx}
                                                toolName={msg.actionResult!.action}
                                                state={'completed'}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Message Bubble - The "Glass" Upgrade */}
                                <div className={`
                                    py-3 px-5 rounded-2xl text-[15px] leading-relaxed tracking-wide font-medium backdrop-blur-sm
                                    ${msg.role === 'user'
                                        ? 'bg-gradient-to-br from-[#4c1d95] to-[#5b21b6] text-white shadow-lg shadow-purple-900/20 border border-white/10 rounded-tr-md' // Premium Gradient User Bubble
                                        : 'bg-transparent text-white/90 px-0 shadow-none' // Assistant text floats on background
                                    }
                                `}>
                                    {msg.role === 'user' ? (
                                        msg.text
                                    ) : (
                                        <div className="markdown-body">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.text}
                                            </ReactMarkdown>
                                        </div>
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
                                                } catch (e: any) { console.error(e); }
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

                    {isThinking && <ThinkingIndicator status={thinkingStatus} />}
                    <div ref={messagesEndRef} className="h-4" />
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
                        className={`
                            relative bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-2 flex items-end gap-3 shadow-2xl shadow-black/50
                            transition-all duration-300 ring-1 ring-white/5
                            ${isTyping ? 'ring-purple-500/30' : 'hover:ring-white/20'}
                        `}
                    >
                        {/* Inner "Neural Activity" Glow */}
                        <div className={`absolute inset-0 rounded-[2rem] bg-gradient-to-r from-purple-500/10 via-transparent to-indigo-500/10 opacity-0 transition-opacity duration-500 pointer-events-none ${isTyping ? 'opacity-100' : ''}`} />

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
                            placeholder="Ask Alto to scan, clean, or explain..."
                            className="w-full bg-transparent text-white placeholder:text-white/30 text-[15px] px-5 py-3.5 min-h-[52px] max-h-[160px] resize-none focus:outline-none scrollbar-hide font-medium tracking-wide"
                            rows={1}
                        />

                        {/* Action Button - Circular Gradient */}
                        <button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isThinking}
                            className={`
                                w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 relative overflow-hidden group/btn mb-1 mr-1
                                ${input.trim()
                                    ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95'
                                    : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'}
                            `}
                        >
                            {isThinking ? (
                                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            ) : (
                                <ArrowUp size={22} strokeWidth={2.5} className="group-hover/btn:-translate-y-0.5 transition-transform" />
                            )}
                        </button>
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
