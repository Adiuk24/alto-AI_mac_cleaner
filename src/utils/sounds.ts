// Utility to play system sounds for scan completion and other events

export function playCompletionSound() {
    try {
        // Use the macOS system sound via Audio API
        // Create a short synthesized "ding" sound using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Create a pleasant completion chime
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
        oscillator.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.1); // C#6
        oscillator.frequency.setValueAtTime(1318.51, audioContext.currentTime + 0.2); // E6

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch {
        // Silently fail if audio is not available
    }
}
