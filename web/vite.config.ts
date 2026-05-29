import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/viz/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/events': { target: 'http://localhost:3000', ws: false },
    },
  },
  test: { environment: 'jsdom', globals: true },
})
