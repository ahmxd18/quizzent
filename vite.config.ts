import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Browser requests to /api go to Express during local development.
      // Keep the browser's Host so the API and WebSocket Origin checks agree.
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false },
      '/socket.io': { target: 'http://127.0.0.1:3001', ws: true, changeOrigin: false },
    },
  },
})
