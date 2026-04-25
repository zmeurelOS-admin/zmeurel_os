import { loadEnv } from 'vite'

const TEST_ENV_DEFAULTS = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  SITE_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  CRON_SECRET: 'test-cron-secret',
  DESTRUCTIVE_ACTION_STEP_UP_SECRET: 'test-destructive-step-up-secret',
} as const

export function installVitestEnv(mode: string, rootDir: string) {
  const loadedEnv = loadEnv(mode, rootDir, '')

  for (const [key, value] of Object.entries(loadedEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }

  for (const [key, value] of Object.entries(TEST_ENV_DEFAULTS)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }

  process.env.SUPABASE_TEST_URL ??= process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.SUPABASE_TEST_ANON_KEY ??= process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ??= process.env.SUPABASE_SERVICE_ROLE_KEY
}
