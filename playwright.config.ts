import { defineConfig, devices } from '@playwright/test';

// Session 3 writes the specs in tests/e2e. The phone viewport is the done-criteria size.
export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4173/godot-vocabulary/' },
  projects: [{ name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true } }],
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173/godot-vocabulary/',
    reuseExistingServer: false,
  },
});
