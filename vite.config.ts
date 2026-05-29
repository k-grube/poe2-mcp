import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// the viz UI lives in web/; built bundle goes to web/dist, served at /viz
export default defineConfig({
  root: 'web',
  base: '/viz/',
  plugins: [react()],
})
