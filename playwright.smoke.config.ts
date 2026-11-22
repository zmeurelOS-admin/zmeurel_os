import { defineConfig, devices } from '@playwright/test'

/**
 * Plasa de teste „smoke” (promptul 27, D): pașii principali ai aplicației, pe un demo nou creat din interfață
 * (`/start` → „Continuă fără cont” → „Fructe de pădure”). Nu scrie decât în demo-ul creat și iese din cont la final.
 *
 * Rulează pe serverul local cu build de producție: `npm run build`, apoi `npm run test:e2e:smoke`
 * (pornește singur `next start` dacă nu rulează deja nimic pe 3000). NU rulează în CI.
 * Atenție: serverul local folosește baza de producție; de aceea testele ating doar demo-ul lor.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e/smoke',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    headless: true,
    locale: 'ro-RO',
    timezoneId: 'Europe/Bucharest',
  },
  projects: [
    {
      name: 'smoke',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npx next start -p 3000',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
