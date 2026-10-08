import { defineConfig, devices } from "@playwright/test";

const basePath = process.env.TEST_BASE_PATH ?? "";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:4173${basePath}/`,
    colorScheme: "dark",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "node scripts/serve-export.mjs",
    url: `http://127.0.0.1:4173${basePath}/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
