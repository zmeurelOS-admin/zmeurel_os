import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { installVitestEnv } from './vitest.env'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  installVitestEnv(mode, __dirname)

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'server-only': path.resolve(__dirname, './src/test/server-only.ts'),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: [
        'src/app/api/paste-to-cheltuieli/__tests__/*.test.ts',
        'src/app/api/paste-to-investitii/__tests__/*.test.ts',
        'src/app/api/shop/__tests__/*.test.ts',
        'src/app/api/gdpr/__tests__/*.test.ts',
        'src/app/api/farm/__tests__/*.test.ts',
        'src/app/api/chat/__tests__/*.test.ts',
        'src/app/api/cron/__tests__/*.test.ts',
        'src/app/api/integrations/google/__tests__/*.test.ts',
        'src/components/cheltuieli/__tests__/*.test.tsx',
        'src/components/investitii/__tests__/*.test.tsx',
        'src/lib/auth/__tests__/*.test.ts',
        'src/lib/integrations/__tests__/*.test.ts',
        'src/lib/logging/__tests__/*.test.ts',
        'src/lib/security/__tests__/*.test.ts',
        'src/lib/supabase/queries/__tests__/financial-saves.test.ts',
        'src/lib/tenant/__tests__/destructive-cleanup.test.ts',
      ],
      exclude: ['node_modules', 'e2e', 'tests', '.next'],
    },
  }
})
