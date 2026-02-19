import { motion } from 'framer-motion';

interface AltoAvatarProps {
    size?: number;
    className?: string;
    isThinking?: boolean;
    isTyping?: boolean; // New prop for user interaction
}

export function AltoAvatar({ size = 40, className = "", isThinking = false, isTyping = false }: AltoAvatarProps) {
    // Dynamic Speed: 
    // - Idle: Slow (8s)
    // - Thinking: Fast (2s)
    // - Typing: Excited (4s)
    const ringSpeed = isThinking ? 2 : (isTyping ? 4 : 8);
    const coreScale = isThinking ? [1, 1.2, 1] : (isTyping ? [1, 1.05, 1] : 1);
    const coreOpacity = isThinking ? 1 : (isTyping ? 0.9 : 0.8);

    return (
        <div
            className={`relative flex items-center justify-center ${className}`}
            style={{ width: size, height: size }}
        >
            {/* Outer Glow - Reacts to Typing */}
            <motion.div
                className="absolute inset-0 bg-purple-500/30 rounded-full blur-md"
                animate={{
                    opacity: isTyping ? 0.6 : 0.3,
                    scale: isTyping ? 1.2 : 1
                }}
            />

            {/* Rotating Outer Ring */}
            <motion.div
                className="absolute inset-0 rounded-full border-[2px] border-t-purple-400 border-r-transparent border-b-indigo-400 border-l-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: ringSpeed, repeat: Infinity, ease: "linear" }}
            />

            {/* Counter-Rotating Inner Ring */}
            <motion.div
                className="absolute inset-[15%] rounded-full border-[2px] border-t-transparent border-r-cyan-400 border-b-transparent border-l-blue-500 opacity-80"
                animate={{ rotate: -360 }}
                transition={{ duration: ringSpeed * 1.5, repeat: Infinity, ease: "linear" }}
            />

            {/* Core - The "Soul" */}
            <motion.div
                className="absolute inset-[30%] bg-gradient-to-br from-indigo-100 to-white rounded-full shadow-[0_0_15px_rgba(139,92,246,0.6)]"
                animate={{
                    scale: coreScale,
                    opacity: coreOpacity
                }}
                transition={{
                    duration: isThinking ? 1.5 : (isTyping ? 0.5 : 0),
                    repeat: (isThinking || isTyping) ? Infinity : 0,
                    ease: "easeInOut"
                }}
            />

            {/* Interactive Iris - follows "thought" process */}
            <motion.div
                className="absolute w-[10%] h-[10%] bg-indigo-600 rounded-full"
                animate={{
                    x: isThinking ? [0, 2, -2, 0] : 0,
                    y: isThinking ? [0, -1, 1, 0] : 0
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatType: "reverse"
                }}
            />
        </div>
    );
}
