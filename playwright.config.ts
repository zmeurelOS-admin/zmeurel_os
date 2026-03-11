import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Zmeurel OS Security Tests
 * Testing RLS-First Architecture with strict tenant isolation
 */
export default defineConfig({
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'tests/e2e/**/*.spec.ts'],
  
  /* Run tests in files in parallel */
  fullyParallel: false, // Important: Security tests must run sequentially to avoid conflicts
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 1,
  
  /* Reporter to use. */
  reporter: 'html',
  
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',
    
    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video on failure */
    video: 'retain-on-failure',

    /* Always run headless for CI compatibility */
    headless: true,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run build && npm start',
    port: 3000,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
});
