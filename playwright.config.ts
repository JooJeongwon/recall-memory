import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:3000", ...devices["iPhone 13"], browserName: "chromium", channel: "chromium", trace: "off", screenshot: "off", video: "off" },
  webServer: { command: "npm run dev -- --hostname 127.0.0.1", url: "http://127.0.0.1:3000", reuseExistingServer: !process.env.CI,
    env: { APP_BASE_URL: "http://localhost:3000" } },
});
