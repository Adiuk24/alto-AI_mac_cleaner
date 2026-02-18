import { type ButtonHTMLAttributes, forwardRef } from 'react';
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
            primary: "bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.3)] border-transparent",
            secondary: "bg-white/10 text-white hover:bg-white/20 border-white/10 backdrop-blur-md",
            ghost: "bg-transparent text-white/70 hover:text-white hover:bg-white/5 border-transparent",
            gradient: "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 border-transparent",
            glass: "glass-strong text-white hover:bg-white/10 border-white/10"
        };

        const sizes = {
            sm: "px-3 py-1.5 text-xs",
            md: "px-5 py-2.5 text-sm",
            lg: "px-8 py-4 text-base",
            icon: "p-2 aspect-square"
        };

        return (
            <motion.button
                ref={ref}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                    "relative inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 border",
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
