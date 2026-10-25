import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  // Tests run against the production build, not the dev server.
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: false, timeout: 120_000 },
})
