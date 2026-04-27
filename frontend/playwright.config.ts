import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    screenshot: 'on',
    video: 'on',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 20000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
