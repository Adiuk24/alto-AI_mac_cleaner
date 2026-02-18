import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

interface AppInstallPayload {
    name: string;
    path: string;
}

export function NotificationManager() {
    useEffect(() => {
        let unlisten: (() => void) | undefined;

        const setup = async () => {
            // 1. Request permission if not granted
            let granted = await isPermissionGranted();
            if (!granted) {
                const permission = await requestPermission();
                granted = permission === 'granted';
            }

            if (granted) {
                // 2. Listen for app-installed events
                unlisten = await listen<AppInstallPayload>('app-installed', (event) => {
                    sendNotification({
                        title: 'New App Detected',
                        body: `Alto noticed you installed ${event.payload.name}. Analysis complete.`,
                    });

                    // Also dispatch internal event for AI to react
                    window.dispatchEvent(new CustomEvent('ai-proactive-message', {
                        detail: `I see you installed **${event.payload.name}**. I've scanned it and it looks clean!`
                    }));
                });
            }
        };

        setup();

        return () => {
            if (unlisten) unlisten();
        };
    }, []);

    return null; // Logic only component
}
