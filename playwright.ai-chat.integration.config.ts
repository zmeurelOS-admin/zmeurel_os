import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: ['tests/ai-chat-route.integration.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
})
