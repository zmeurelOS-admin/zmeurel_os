import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/app/api/shop/__tests__/*.test.ts',
      'src/app/api/gdpr/__tests__/*.test.ts',
      'src/app/api/farm/__tests__/*.test.ts',
      'src/app/api/chat/__tests__/*.test.ts',
      'src/app/api/cron/__tests__/demo-tenant-cleanup.route.test.ts',
      'src/lib/auth/__tests__/*.test.ts',
      'src/lib/integrations/__tests__/*.test.ts',
      'src/lib/logging/__tests__/*.test.ts',
      'src/lib/security/__tests__/*.test.ts',
      'src/lib/tenant/__tests__/destructive-cleanup.test.ts',
    ],
    exclude: ['node_modules', 'e2e', 'tests', '.next'],
  },
})
