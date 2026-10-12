import { defineConfig, devices } from '@playwright/test';
process.loadEnvFile('.env.local');
const baseURL=process.env.CHECKPOINT_BASE_URL || 'http://localhost:3010';
export default defineConfig({
 testDir:'./tests/e2e', testMatch:'note-checkpoints.spec.ts', workers:1, timeout:120_000,
 use:{baseURL,...devices['iPhone 13'],browserName:'chromium',channel:'chromium',trace:'off',screenshot:'off',video:'off'},
 webServer:process.env.CHECKPOINT_BASE_URL ? undefined : {
  command:'npm run start -- --port 3010',url:'http://localhost:3010',reuseExistingServer:false,
  env:{APP_BASE_URL:baseURL},
 },
});
