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
    className?: string; // Explicitly add className here to satisfy TypeScript
    children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
        const variants = {
            primary: "bg-primary text-primary-foreground hover:brightness-110 shadow-[0_0_20px_rgba(244,114,182,0.3)] hover:shadow-[0_0_30px_rgba(244,114,182,0.5)] border-transparent",
            secondary: "bg-secondary/20 text-secondary-foreground hover:bg-secondary/30 border-secondary/20 backdrop-blur-md",
            ghost: "bg-transparent text-white/70 hover:text-white hover:bg-white/5 border-transparent",
            gradient: "bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 border-transparent",
            glass: "glass-card text-white hover:bg-white/10 border-white/10 hover:border-white/20"
        };

        const sizes = {
            sm: "px-4 py-2 text-xs",
            md: "px-6 py-3 text-sm",
            lg: "px-10 py-5 text-base",
            icon: "p-2 aspect-square"
        };

        return (
            <motion.button
                ref={ref}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                    "relative inline-flex items-center justify-center rounded-2xl font-semibold transition-all duration-300 border cursor-pointer",
                    "disabled:opacity-50 disabled:pointer-events-none disabled:saturate-0",
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            >
                {/* Glow effect for gradient/primary buttons */}
                {(variant === 'gradient' || variant === 'primary') && (
                    <div className="absolute inset-0 rounded-xl bg-inherit blur-xl opacity-0 transition-opacity hover:opacity-40 -z-10" />
                )}
                {children}
            </motion.button>
        );
    }
);

Button.displayName = "Button";
