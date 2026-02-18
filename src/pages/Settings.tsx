import { useState, useEffect } from 'react';
import { aiService, type AIConfig, type TestConnectionResult } from '../services/aiService';
import { Button } from '../components/Button';
import { Save, RefreshCw, Cpu, Wifi, WifiOff, Loader2 } from 'lucide-react';

export function Settings() {
    const [config, setConfig] = useState<AIConfig>(aiService.getConfig());
    const [status, setStatus] = useState<string>('');
    const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        setConfig(aiService.getConfig());
    }, []);

    const handleChange = (field: keyof AIConfig, value: string) => {
        setConfig(prev => ({ ...prev, [field]: value }));
        // Clear test result when config changes
        setTestResult(null);
    };

    const handleSave = () => {
        aiService.saveConfig(config);
        setStatus('Settings Saved!');
        setTestResult(null);
        setTimeout(() => setStatus(''), 2000);
    };

    const handleTestConnection = async () => {
        // Save config first so the test uses the latest settings
        aiService.saveConfig(config);
        setIsTesting(true);
        setTestResult(null);
        try {
            const result = await aiService.testConnection();
            setTestResult(result);
        } catch (e: any) {
            setTestResult({ ok: false, message: e.message || 'Test failed', latencyMs: 0 });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="p-10 h-full overflow-y-auto">
            <h2 className="text-3xl font-bold mb-8">Settings</h2>

            <div className="space-y-8 max-w-3xl">
                {/* AI Configuration Section */}
                <div className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md">
                    <h3 className="text-xl font-semibold mb-6 flex items-center gap-3">
                        <Cpu className="text-purple-400" size={24} />
                        Intelligence Engine
                    </h3>

                    <div className="space-y-6">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-white/80">AI Provider</label>
                            <div className="relative">
                                <select
                                    value={config.provider}
                                    onChange={(e) => handleChange('provider', e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 appearance-none transition-colors hover:bg-black/50"
                                >
                                    <option value="webllm">Local (WebLLM) - Best Privacy</option>
                                    <option value="ollama">Ollama (Advanced)</option>
                                    <option value="openai">OpenAI (Cloud)</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                    <RefreshCw size={14} />
                                </div>
                            </div>
                            <p className="text-xs text-white/40 px-1">
                                Choose where Alto's brain lives. webLLM runs entirely in your browser.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-4">
                            {config.provider === 'ollama' && (
                                <>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm text-white/70">Ollama URL</label>
                                        <input
                                            type="text"
                                            value={config.baseUrl}
                                            onChange={(e) => handleChange('baseUrl', e.target.value)}
                                            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50"
                                            placeholder="http://localhost:11434/api/chat"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm text-white/70">Model Tag</label>
                                        <input
                                            type="text"
                                            value={config.model}
                                            onChange={(e) => handleChange('model', e.target.value)}
                                            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50"
                                            placeholder="llama3"
                                        />
                                    </div>
                                </>
                            )}

                            {config.provider === 'openai' && (
                                <>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm text-white/70">API Key</label>
                                        <input
                                            type="password"
                                            value={config.apiKey || ''}
                                            onChange={(e) => handleChange('apiKey', e.target.value)}
                                            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50"
                                            placeholder="sk-..."
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm text-white/70">Model Name</label>
                                        <input
                                            type="text"
                                            value={config.model}
                                            onChange={(e) => handleChange('model', e.target.value)}
                                            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50"
                                            placeholder="gpt-4-turbo"
                                        />
                                    </div>
                                </>
                            )}

                            {config.provider === 'webllm' && (
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm text-white/70">Model Selection</label>
                                    <select
                                        value={config.model}
                                        onChange={(e) => handleChange('model', e.target.value)}
                                        className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500/50"
                                    >
                                        <option value="gemma-2-2b-it-q4f16_1-MLC">Google Gemma 2 (2B) - Fast</option>
                                        <option value="Llama-3-8B-Instruct-q4f32_1-MLC">Meta Llama 3 (8B) - Balanced</option>
                                        <option value="Phi-3-mini-4k-instruct-q4f16_1-MLC">Microsoft Phi 3 - Compact</option>
                                    </select>
                                    <div className="mt-2 text-xs text-amber-300/80 bg-amber-500/10 p-2 rounded">
                                        Note: First run requires downloading ~2-4GB of model weights.
                                    </div>
                                </div>
                            )}


                        </div>

                        {/* Test Connection Result */}
                        {testResult && (
                            <div className={`p-4 rounded-xl border flex items-center gap-3 ${testResult.ok
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : 'bg-red-500/10 border-red-500/30'
                                }`}>
                                {testResult.ok
                                    ? <Wifi size={20} className="text-emerald-400 shrink-0" />
                                    : <WifiOff size={20} className="text-red-400 shrink-0" />
                                }
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${testResult.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                                        {testResult.ok ? 'Connected' : 'Connection Failed'}
                                    </p>
                                    <p className="text-xs text-white/50 truncate">{testResult.message}</p>
                                </div>
                                {testResult.latencyMs > 0 && (
                                    <span className="text-xs text-white/40 shrink-0">{testResult.latencyMs}ms</span>
                                )}
                            </div>
                        )}

                        <div className="pt-2 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Button onClick={handleSave} variant="primary" className="gap-2 px-6">
                                    <Save size={18} /> Save Configuration
                                </Button>
                                <Button
                                    onClick={handleTestConnection}
                                    variant="secondary"
                                    className="gap-2 px-5"
                                    disabled={isTesting}
                                >
                                    {isTesting
                                        ? <><Loader2 size={16} className="animate-spin" /> Testing...</>
                                        : <><Wifi size={16} /> Test Connection</>
                                    }
                                </Button>
                            </div>
                            {status && <span className="text-emerald-400 text-sm font-medium animate-pulse">{status}</span>}
                        </div>
                    </div>
                </div>

                {/* Info Footer */}
                <div className="flex justify-between items-center text-white/30 text-sm px-4">
                    <p>Alto 0.1.0-alpha</p>
                    <p>System Assessment & Logic Tool</p>
                </div>
            </div>
        </div>
    );
}
