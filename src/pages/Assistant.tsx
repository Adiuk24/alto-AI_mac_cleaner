import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, User, Sparkles, Zap, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { aiService, type ActionResult } from '../services/aiService';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    actionResult?: ActionResult;
}

export function Assistant() {
    const [input, setInput] = useState('');
    const [loadProgress, setLoadProgress] = useState('');
    const [isExecutingAction, setIsExecutingAction] = useState(false);

    useEffect(() => {
        aiService.setLoadProgressCallback((text) => setLoadProgress(text));
        return () => aiService.setLoadProgressCallback(() => { });
    }, []);

    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            text: "Hello! I'm ready to help you clean and optimize your Mac.",
            timestamp: new Date()
        }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const handleProactiveMessage = (event: Event) => {
            const customEvent = event as CustomEvent;
            const text = customEvent.detail;
            const newMsg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                text: text,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, newMsg]);
        };

        window.addEventListener('ai-proactive-message', handleProactiveMessage);

        return () => {
            window.removeEventListener('ai-proactive-message', handleProactiveMessage);
        };
    }, []);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: input,
            timestamp: new Date()
        };

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setIsTyping(true);

        try {
            // Prepare messages for AI Service
            const apiMessages = newMessages.map(m => ({ role: m.role, content: m.text }));

            // Call AI Service (now returns { text, actionResult? })
            const response = await aiService.chat(apiMessages);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: response.text,
                timestamp: new Date(),
                actionResult: response.actionResult
            };

            setMessages(prev => [...prev, aiMsg]);

            // If an action was executed, show execution indicator briefly
            if (response.actionResult) {
                setIsExecutingAction(true);
                setTimeout(() => setIsExecutingAction(false), 1500);
            }
        } catch (error: any) {
            console.error(error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: `Connection Error: ${error.message || 'Unknown error occurred.'}\n\nCheck your Settings or ensure your AI provider is running.`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const renderActionCard = (actionResult: ActionResult) => {
        const isSuccess = actionResult.success;
        const actionLabels: Record<string, string> = {
            scan_junk: '🗑️ Junk Scan',
            clean_junk: '🧹 Junk Cleanup',
            scan_malware: '🛡️ Malware Scan',
            optimize_speed: '⚡ Speed Optimization',
            scan_large_files: '📦 Large File Scan'
        };

        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`mt-3 rounded-xl p-3 border ${isSuccess
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                    }`}
            >
                <div className="flex items-center gap-2 mb-1">
                    {isSuccess
                        ? <CheckCircle size={16} className="text-emerald-400" />
                        : <XCircle size={16} className="text-red-400" />
                    }
                    <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
                        {actionLabels[actionResult.action] || actionResult.action}
                    </span>
                </div>
                <p className={`text-sm font-medium ${isSuccess ? 'text-emerald-300' : 'text-red-300'}`}>
                    {actionResult.summary}
                </p>
            </motion.div>
        );
    };

    return (
        <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
            <header className="mb-6 flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-purple-500/20">
                    <Bot className="text-white" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">AI Assistant</h1>
                    <p className="text-white/50 text-sm flex items-center gap-2">
                        Always here to help optimize your Mac
                        {isExecutingAction && (
                            <span className="inline-flex items-center gap-1 text-amber-400 text-xs animate-pulse">
                                <Zap size={12} /> Executing...
                            </span>
                        )}
                    </p>
                </div>
            </header>

            <div className="flex-1 bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-inner">
                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user'
                                ? 'bg-white/10 text-white'
                                : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md'
                                }`}>
                                {msg.role === 'user' ? <User size={20} /> : <Sparkles size={20} />}
                            </div>

                            <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user'
                                ? 'bg-white text-black rounded-tr-none'
                                : 'bg-white/10 text-white border border-white/5 rounded-tl-none'
                                }`}>
                                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {msg.text.split('**').map((part, i) =>
                                        i % 2 === 1 ? <strong key={i} className="font-bold">{part}</strong> : part
                                    )}
                                </div>
                                {/* Action Result Card */}
                                {msg.actionResult && renderActionCard(msg.actionResult)}
                                <div className="mt-1 text-[10px] opacity-40 text-right">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {isTyping && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex gap-4"
                        >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                                <Sparkles size={20} className="text-white/80" />
                            </div>
                            <div className="bg-white/5 text-white border border-white/5 rounded-2xl rounded-tl-none p-4 flex items-center gap-1.5 h-12">
                                <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/10 bg-white/5">
                    {loadProgress && (
                        <div className="mb-4">
                            <div className="flex justify-between text-xs text-white/50 mb-1">
                                <span>Loading Model...</span>
                                <span>{loadProgress}</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-purple-500"
                                    initial={{ width: "0%" }}
                                    animate={{ width: "100%" }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="relative flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Try: 'Scan my Mac for junk' or 'Optimize my speed'..."
                            className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-black/40 transition-all font-medium"
                            autoFocus
                        />
                        <Button
                            onClick={handleSend}
                            disabled={!input.trim() || isTyping}
                            variant="primary"
                            size="icon"
                            className="w-12 h-12 rounded-xl shrink-0"
                        >
                            <Send size={20} className={input.trim() ? "ml-0.5" : ""} />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
