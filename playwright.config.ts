import { defineConfig, devices } from '@playwright/test'

// BASE_URL=https://… npm run e2e  tests a deployed site instead of a local production build.
const live = process.env.BASE_URL

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: live ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: live ?? 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  // Locally, tests run against the production build, not the dev server.
  webServer: live ? undefined : { command: 'npm run build && npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: false, timeout: 120_000 },
})
