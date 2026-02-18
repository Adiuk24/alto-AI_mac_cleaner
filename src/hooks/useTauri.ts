import { invoke } from '@tauri-apps/api/core';
import { useState, useCallback } from 'react';

export function useTauri() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const call = useCallback(async <T>(command: string, args?: Record<string, unknown>): Promise<T | null> => {
        setLoading(true);
        setError(null);
        try {
            const result = await invoke<T>(command, args);
            return result;
        } catch (err) {
            console.error(`Tauri command '${command}' failed:`, err);
            setError(err as string);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    return { call, loading, error };
}
