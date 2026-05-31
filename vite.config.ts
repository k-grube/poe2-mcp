import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// the viz UI lives in web/; built bundle goes to web/dist, served at / (root)
export default defineConfig({
  root: 'web',
  base: '/',
  plugins: [react()],
})
