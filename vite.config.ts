import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// the viz UI lives in src/web/; built bundle goes to src/web/dist, served at / (root)
export default defineConfig({
  root: 'src/web',
  base: '/',
  plugins: [react()],
})
