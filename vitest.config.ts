import { defineConfig } from "vitest/config";
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
export default defineConfig({
  resolve: { alias: { "cloudflare:workers": new URL("./tests/mocks/cloudflare-workers.ts", import.meta.url).pathname } },
  test: { projects: [
  { test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"] } },
  { test: { name: "integration", environment: "node", include: ["tests/integration/**/*.test.ts"], testTimeout: 30_000 } },
] } });
