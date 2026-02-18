/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: "hsl(var(--card))",
                'card-foreground': "hsl(var(--card-foreground))",
                popover: "hsl(var(--popover))",
                'popover-foreground': "hsl(var(--popover-foreground))",
                primary: "hsl(var(--primary))",
                'primary-foreground': "hsl(var(--primary-foreground))",
                secondary: "hsl(var(--secondary))",
                'secondary-foreground': "hsl(var(--secondary-foreground))",
                muted: "hsl(var(--muted))",
                'muted-foreground': "hsl(var(--muted-foreground))",
                accent: "hsl(var(--accent))",
                'accent-foreground': "hsl(var(--accent-foreground))",
                destructive: "hsl(var(--destructive))",
                'destructive-foreground': "hsl(var(--destructive-foreground))",
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            animation: {
                "spin-slow": "spin 3s linear infinite",
                "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "float": "float 6s ease-in-out infinite",
            },
            keyframes: {
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-10px)" },
                }
            }
        },
    },
    plugins: [],
}
