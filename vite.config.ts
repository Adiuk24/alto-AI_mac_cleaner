import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext', // Use modern JS features for performance
    minify: 'esbuild', // Fast and efficient minification
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'framer-motion'],
          'vendor-ui': ['lucide-react'],
          'ai-engine': ['@mlc-ai/web-llm'] // Isolate the heavy AI engine
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ["@mlc-ai/web-llm"]
  }
})
