import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// two suites in one run: server tests (node) and viz tests (jsdom)
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'web',
          environment: 'jsdom',
          globals: true,
          include: ['web/src/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
})
