import { defineConfig, devices } from '@playwright/test';

// The phone viewport is the done-criteria size. Service workers are blocked except in the offline
// spec, which turns them back on: a cached shell must not leak between specs.
export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/godot-vocabulary/',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true } }],
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173/godot-vocabulary/',
    reuseExistingServer: false,
  },
});
