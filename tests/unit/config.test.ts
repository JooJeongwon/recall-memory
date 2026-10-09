import { expect, it, vi } from "vitest";
import { isConfigured } from "../../src/lib/config";

it("공개 키만 있으면 미연결로 표시하고 서버 키까지 있어야 앱을 활성화한다", () => {
  try {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
    vi.stubEnv("SUPABASE_SERVER_SECRET_KEY", "");
    expect(isConfigured()).toBe(false);
    vi.stubEnv("SUPABASE_SERVER_SECRET_KEY", "server-test-key");
    expect(isConfigured()).toBe(true);
  } finally { vi.unstubAllEnvs(); }
});
