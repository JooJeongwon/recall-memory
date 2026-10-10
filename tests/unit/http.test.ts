import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { isAllowedAppOrigin, requestOrigin } from "../../src/lib/server/http";

afterEach(() => vi.unstubAllEnvs());

it("allows only the configured origin and its loopback alias in development", () => {
  vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
  vi.stubEnv("NODE_ENV", "development");

  expect(isAllowedAppOrigin("http://localhost:3000")).toBe(true);
  expect(isAllowedAppOrigin("http://127.0.0.1:3000")).toBe(true);
  expect(isAllowedAppOrigin("http://evil.example:3000")).toBe(false);
  vi.stubEnv("NODE_ENV", "production");
  expect(isAllowedAppOrigin("http://127.0.0.1:3000")).toBe(false);
  vi.stubEnv("NODE_ENV", "development");
  const request = { url: "http://localhost:3000/auth/confirm", headers: new Headers({
    host: "127.0.0.1:3000", "x-forwarded-host": "localhost:3000", "x-forwarded-proto": "http",
  }) } as Request;
  expect(requestOrigin(request)).toBe("http://127.0.0.1:3000");
});
