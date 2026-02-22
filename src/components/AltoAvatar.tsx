import { motion, AnimatePresence } from 'framer-motion';

interface AltoAvatarProps {
    size?: number;
    className?: string;
    isThinking?: boolean;
    isTyping?: boolean;
}

export function AltoAvatar({ size = 40, className = "", isThinking = false, isTyping = false }: AltoAvatarProps) {
    const ringSpeed = isThinking ? 3 : (isTyping ? 5 : 10);

    return (
        <div
            className={`relative flex items-center justify-center ${className}`}
            style={{ width: size, height: size }}
        >
            {/* Soft Ambient Radiance */}
            <motion.div
                className="absolute inset-[-20%] rounded-full bg-primary/20 blur-2xl"
                animate={{
                    opacity: [0.2, 0.4, 0.2],
                    scale: [0.8, 1.1, 0.8]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Main Outer Ring */}
            <motion.div
                className="absolute inset-0 rounded-full border-[1.5px] border-white/20"
                animate={{ rotate: 360 }}
                transition={{ duration: ringSpeed * 2, repeat: Infinity, ease: "linear" }}
            >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_#ec4899]" />
            </motion.div>

            {/* Inner Glowing Ring */}
            <motion.div
                className="absolute inset-[10%] rounded-full border-[1.5px] border-t-transparent border-r-indigo-400 border-b-transparent border-l-purple-500 opacity-60"
                animate={{ rotate: -360 }}
                transition={{ duration: ringSpeed, repeat: Infinity, ease: "linear" }}
            />

            {/* Core Orb */}
            <motion.div
                className="absolute inset-[25%] rounded-full z-10"
                initial={false}
                animate={{
                    scale: isThinking ? [1, 1.15, 1] : (isTyping ? [1, 1.05, 1] : [1, 1.02, 1]),
                    backgroundColor: isThinking ? "rgba(139, 92, 246, 0.9)" : "rgba(255, 255, 255, 0.95)"
                }}
                transition={{
                    duration: isThinking ? 1.5 : (isTyping ? 0.6 : 3),
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                style={{
                    boxShadow: isThinking
                        ? "0 0 30px rgba(139, 92, 246, 0.8), inset 0 2px 10px rgba(255,255,255,0.8)"
                        : "0 0 20px rgba(255, 255, 255, 0.4), inset 0 2px 5px rgba(255,255,255,1)",
                    background: "radial-gradient(circle at 30% 30%, white, rgba(236, 252, 255, 0.8))"
                }}
            >
                {/* Iris / Pupil */}
                <motion.div
                    className="absolute inset-[35%] bg-indigo-950 rounded-full opacity-80 overflow-hidden"
                >
                    <motion.div
                        className="absolute inset-0 bg-indigo-500/40"
                        animate={{
                            x: isThinking ? [-2, 2, -2] : 0,
                            y: isThinking ? [1, -1, 1] : 0
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                </motion.div>
            </motion.div>

            {/* Particles (Thinking State Only) */}
            <AnimatePresence>
                {isThinking && [...Array(4)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-primary rounded-full"
                        initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                        animate={{
                            opacity: [0, 1, 0],
                            scale: [0, 1, 0],
                            x: (i % 2 === 0 ? 1 : -1) * (20 + Math.random() * 20),
                            y: (i < 2 ? 1 : -1) * (20 + Math.random() * 20),
                        }}
                        exit={{ opacity: 0 }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.3,
                            ease: "easeOut"
                        }}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
}
