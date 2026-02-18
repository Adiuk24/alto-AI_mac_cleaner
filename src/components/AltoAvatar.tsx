import { motion } from 'framer-motion';

interface AltoAvatarProps {
    size?: number;
    className?: string;
    isThinking?: boolean;
}

export function AltoAvatar({ size = 40, className = "", isThinking = false }: AltoAvatarProps) {
    return (
        <div
            className={`relative flex items-center justify-center ${className}`}
            style={{ width: size, height: size }}
        >
            {/* Outer Glow */}
            <div className="absolute inset-0 bg-purple-500/30 rounded-full blur-md" />

            {/* Rotating Outer Ring */}
            <motion.div
                className="absolute inset-0 rounded-full border-[2px] border-t-purple-400 border-r-transparent border-b-indigo-400 border-l-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />

            {/* Counter-Rotating Inner Ring */}
            <motion.div
                className="absolute inset-[15%] rounded-full border-[2px] border-t-transparent border-r-cyan-400 border-b-transparent border-l-blue-500 opacity-80"
                animate={{ rotate: -360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            />

            {/* Core */}
            <motion.div
                className="absolute inset-[30%] bg-gradient-to-br from-indigo-100 to-white rounded-full shadow-[0_0_15px_rgba(139,92,246,0.6)]"
                animate={{
                    scale: isThinking ? [1, 1.2, 1] : 1,
                    opacity: isThinking ? [0.8, 1, 0.8] : 1
                }}
                transition={{
                    duration: isThinking ? 1.5 : 0,
                    repeat: isThinking ? Infinity : 0,
                    ease: "easeInOut"
                }}
            />

            {/* Interactive Iris (Optional detail) */}
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
