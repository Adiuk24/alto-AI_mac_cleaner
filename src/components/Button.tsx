import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "className"> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'gradient' | 'glass';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    className?: string;
    children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
        const variants = {
            primary: "bg-primary text-primary-foreground shadow-[0_4px_20px_rgba(236,72,153,0.3)] hover:shadow-[0_8px_30px_rgba(236,72,153,0.5)] border-transparent",
            secondary: "bg-white/10 text-white hover:bg-white/20 border-white/10 backdrop-blur-md",
            ghost: "bg-transparent text-white/60 hover:text-white hover:bg-white/5 border-transparent",
            gradient: "bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/40 border-transparent",
            glass: "glass-frost text-white hover:bg-white/10 border-white/10 hover:border-white/20"
        };

        const sizes = {
            sm: "px-4 py-2 text-xs",
            md: "px-6 py-2.5 text-sm",
            lg: "px-8 py-3.5 text-base",
            icon: "p-2 aspect-square"
        };

        return (
            <motion.button
                ref={ref}
                whileHover={{
                    scale: 1.02,
                    y: -1,
                    transition: { type: "spring", stiffness: 400, damping: 10 }
                }}
                whileTap={{
                    scale: 0.98,
                    y: 0,
                    transition: { type: "spring", stiffness: 400, damping: 10 }
                }}
                className={cn(
                    "relative inline-flex items-center justify-center rounded-2xl font-semibold transition-all duration-300 border cursor-pointer active:brightness-95 select-none",
                    "disabled:opacity-50 disabled:pointer-events-none disabled:grayscale",
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            >
                {/* Shimmer Effect for Primary/Gradient */}
                {(variant === 'primary' || variant === 'gradient') && (
                    <motion.div
                        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-150%]"
                        initial={false}
                        whileHover={{
                            translateX: ["150%"],
                            transition: {
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "linear"
                            }
                        }}
                    />
                )}

                {/* Glow layer */}
                {(variant === 'primary' || variant === 'gradient') && (
                    <div className="absolute inset-0 rounded-2xl bg-inherit blur-xl opacity-0 transition-opacity group-hover:opacity-40 -z-10" />
                )}

                <span className="relative z-10">{children}</span>
            </motion.button>
        );
    }
);

Button.displayName = "Button";
