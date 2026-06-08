import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  root: 'src/web',
  base: '/',
  plugins: [
    react(),
    babel({
      include: ['src/web/**/*.{ts,tsx}'],
      babelConfig: { presets: [reactCompilerPreset()], babelrc: false, configFile: false },
    }),
  ],
})
