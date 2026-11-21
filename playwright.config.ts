import { defineConfig, devices } from '@playwright/test';

// Nutzt einen lokal installierten Chrome, falls die Playwright-Browser nicht heruntergeladen werden können.
const executablePath = process.env.PW_CHROME_PATH || (process.env.CI ? undefined : '/usr/bin/google-chrome');

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    launchOptions: { executablePath, args: ['--no-sandbox'] },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { executablePath, args: ['--no-sandbox'] } } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 860 } }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 180_000 },
});
