import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, ArrowUp } from 'lucide-react';
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
import { useScanStore } from '../store/scanStore';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    actionResult?: ActionResult;
    widgetType?: 'overview' | 'delete_confirm' | null;
    deletePreview?: IndexedFile[];
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
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        try {
            // Phase 1: Ask AI what it wants to do
            const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.text }));
            const response = await aiService.chat(apiMessages);

            setIsThinking(false);

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
                        text: response.text,
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

                // Show placeholder while AI generates real summary
                setMessages(prev => [...prev, {
                    id: aiMsgId,
                    role: 'assistant',
                    text: '',
                    timestamp: new Date(),
                    actionResult: realResult,
                    widgetType: realResult.action === 'show_overview' ? 'overview' : null
                }]);

                // Phase 3: Feed REAL results back to AI for a genuine response
                const realSummaryText = buildRealResultSummary(realResult);
                const followupMessages = [
                    ...apiMessages,
                    { role: 'assistant', content: response.text }, // AI's intent
                    { role: 'user', content: `SYSTEM: The task completed. Here are the REAL results:\n${realSummaryText}\n\nNow write a concise, friendly 2-3 sentence summary of what actually happened using these exact numbers. Do not include any ACTION tags.` }
                ];

                setIsThinking(true);
                const realResponse = await aiService.chat(followupMessages);
                setIsThinking(false);

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
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="h-full flex flex-col relative font-sans">
            {/* Header - Transparent/Glass */}
            <div className="absolute top-0 left-0 right-0 z-10 p-6 flex justify-between items-start pointer-events-none">
                <header className="mb-6 flex items-center gap-3">
                    <div className="p-2 rounded-2xl bg-white/5 border border-white/10 shadow-lg shadow-purple-500/10">
                        <AltoAvatar size={40} isThinking={isThinking} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white leading-tight">Alto AI</h1>
                        <p className="text-xs text-white/50 font-medium">Agentic System &bull; v2.0</p>
                    </div>
                </header>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-20 pt-24 pb-40 scroll-smooth">
                <div className="max-w-3xl mx-auto space-y-6">
                    {messages.map((msg, idx) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {/* Avatar for Assistant */}
                            {msg.role === 'assistant' && (
                                <div className="mt-2 shrink-0">
                                    <AltoAvatar size={32} isThinking={isThinking && idx === messages.length - 1} />
                                </div>
                            )}

                            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

                                {/* Tool Execution Steps (Agentic) */}
                                {msg.role === 'assistant' && msg.actionResult?.steps && (
                                    <div className="mb-3 space-y-2 w-full">
                                        {msg.actionResult.steps.map((_step, idx) => (
                                            <ToolStatus
                                                key={idx}
                                                toolName={msg.actionResult!.action}
                                                state={'completed'} // Ideally we'd animate these one by one
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Message Bubble */}
                                <div className={`
                                    py-3 px-4 rounded-2xl shadow-sm text-sm leading-relaxed
                                    ${msg.role === 'user'
                                        ? 'bg-[#2D2B55] text-white rounded-tr-sm border border-white/10'
                                        : 'bg-transparent text-white/90 px-0 shadow-none' // Assistant text blends with bg
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

                                {/* Widgets */}
                                {msg.widgetType === 'overview' && (
                                    <div className="mt-2 w-full">
                                        <SystemOverviewWidget
                                            stats={systemStats}
                                            junkSize={junkResult?.total_size_bytes || 0}
                                            onClean={() => onNavigate('system-junk')}
                                            onNavigate={onNavigate}
                                        />
                                    </div>
                                )}

                                {/* MCP Safety: Delete Confirmation Card */}
                                {msg.widgetType === 'delete_confirm' && msg.deletePreview && (
                                    <div className="mt-2 w-full">
                                        <DeleteConfirmCard
                                            files={msg.deletePreview}
                                            onConfirm={async (safePaths) => {
                                                try {
                                                    const result = await invoke<any>('confirm_delete', { paths: safePaths });
                                                    // Update message to show result
                                                    setMessages(prev => prev.map(m => m.id === msg.id ? {
                                                        ...m,
                                                        widgetType: null,
                                                        text: m.text + `\n\n✅ **Done!** Removed ${result.removed} files and freed ${result.bytes_freed ? (result.bytes_freed / 1024 / 1024).toFixed(1) + ' MB' : 'some space'}.`
                                                    } : m));
                                                } catch (e: any) {
                                                    setMessages(prev => prev.map(m => m.id === msg.id ? {
                                                        ...m,
                                                        widgetType: null,
                                                        text: m.text + `\n\n❌ **Error:** ${e.message}`
                                                    } : m));
                                                }
                                            }}
                                            onCancel={() => {
                                                setMessages(prev => prev.map(m => m.id === msg.id ? {
                                                    ...m,
                                                    widgetType: null,
                                                    text: m.text + '\n\n🚫 Cleanup cancelled. No files were deleted.'
                                                } : m));
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Avatar for User */}
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-2">
                                    <User size={14} className="text-white/70" />
                                </div>
                            )}
                        </motion.div>
                    ))}

                    {isThinking && <ThinkingIndicator />}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Floating Input Capsule */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent pb-8">
                <div className="max-w-3xl mx-auto flex flex-col gap-4">

                    {/* Suggestion Chips (Only show if few messages/idle) */}
                    {messages.length < 3 && !isThinking && (
                        <div className="flex justify-center">
                            <SuggestionChips onSelect={(text) => handleSend(text)} />
                        </div>
                    )}

                    <div className="relative bg-[#1A1B2E] border border-white/10 rounded-3xl p-2 shadow-2xl flex items-end gap-2 ring-1 ring-white/5 focus-within:ring-purple-500/50 transition-all">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask Alto anything..."
                            className="w-full bg-transparent text-white placeholder:text-white/30 text-sm px-4 py-3 min-h-[50px] max-h-[200px] resize-none focus:outline-none"
                            rows={1}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isThinking}
                            className={`
                                w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all mb-1
                                ${input.trim()
                                    ? 'bg-white text-black hover:scale-105 active:scale-95'
                                    : 'bg-white/10 text-white/30 cursor-not-allowed'}
                            `}
                        >
                            {isThinking ? (
                                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            ) : (
                                <ArrowUp size={20} strokeWidth={2.5} />
                            )}
                        </button>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-white/30">
                            Alto can make mistakes. Please verify critical system actions.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
