import { afterEach, expect, it, vi } from "vitest";
import { nextVisit, visitInput, visitPage } from "../../src/lib/analytics";
import { recordVisit, isAnalyticsAdmin, analyticsReport } from "../../src/lib/server/analytics";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), requireUser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("../../src/lib/server/admin", () => ({ adminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("../../src/lib/server/auth", () => ({ requireUser: mocks.requireUser }));

afterEach(() => vi.resetAllMocks());
const id = "e5fceea3-7635-4b3c-84fd-183d9806f999";

it("QR에서 로그인 화면으로 이동해도 같은 세션·유입 경로를 유지하고 30분 후 갱신한다", () => {
  const first = nextVisit("home", new URL("https://app.test/?source=qr&private=never-send"), "", null, 1000);
  const second = nextVisit("login", new URL("https://app.test/login"), "", first.session, 2000);
  expect(second.session_id).toBe(first.session_id);
  expect(second.source).toBe("qr");
  expect(second.event_id).not.toBe(first.event_id);
  expect(JSON.stringify(first)).not.toContain("private");
  expect(nextVisit("start", new URL("https://app.test/start"), "", second.session, 1_802_000).session_id).not.toBe(first.session_id);
});

it("직접 방문 중 새 QR 진입은 새 세션이고, 손상된 저장소와 외부 referrer도 처리한다", () => {
  const first = nextVisit("home", new URL("https://app.test"), "", null, 1000);
  expect(nextVisit("home", new URL("https://app.test/?source=qr"), "", first.session, 2000).session_id).not.toBe(first.session_id);
  expect(nextVisit("home", new URL("https://app.test"), "https://other.test/private-value", "broken", 3000).source).toBe("referral");
});

it("사진 식별자는 고정 화면 종류로 바꾸고 콜백·관리자·본문·사용자 ID를 분석 입력에서 제외한다", () => {
  expect(visitPage(`/photos/${id}`)).toBe("photo");
  expect(visitPage(`/photos/${id}/edit`)).toBe("edit");
  expect(visitPage("/auth/confirm")).toBeNull();
  expect(visitPage("/admin/analytics")).toBeNull();
  expect(visitInput.safeParse({ event_id: id, session_id: id, source: "qr", page: "home", user_id: id }).success).toBe(false);
  expect(visitInput.safeParse({ event_id: id, session_id: id, source: "qr", page: `/photos/${id}` }).success).toBe(false);
});

it("관리자는 확인된 두 이메일만 허용하며 일반 사용자는 집계 RPC를 실행하지 않는다", async () => {
  expect(isAnalyticsAdmin({ email: "jwjoo0512@gmail.com", email_confirmed_at: "2026-10-12" })).toBe(true);
  expect(isAnalyticsAdmin({ email: "elice0105412@gmail.com", email_confirmed_at: "2026-10-12" })).toBe(true);
  expect(isAnalyticsAdmin({ email: "jwjoo0512@gmail.com" })).toBe(false);
  mocks.requireUser.mockResolvedValue({ user: { id, email: "other@example.test", email_confirmed_at: "2026-10-12" } });
  await expect(analyticsReport(7)).rejects.toMatchObject({ status: 403 });
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("로그인 여부·사용자 ID는 Auth 검증 결과만 전달하며 익명 요청은 계정 ID 없이 기록한다", async () => {
  mocks.getUser.mockResolvedValueOnce({ data: { user: { id } }, error: null }).mockResolvedValueOnce({ data: { user: null }, error: { status: 400 } });
  mocks.rpc.mockResolvedValue({ error: null });
  const visit = { event_id: id, session_id: id, source: "qr", page: "home" } as const;
  await recordVisit(visit);
  expect(mocks.rpc).toHaveBeenLastCalledWith("record_visit", { p_event_id: id, p_session_id: id, p_source: "qr", p_page: "home", p_user_id: id });
  await recordVisit(visit);
  expect(mocks.rpc.mock.calls[1][1]).not.toHaveProperty("p_user_id");
});

it("Auth 장애를 익명 방문으로 잘못 집계하지 않는다", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
  await expect(recordVisit({ event_id: id, session_id: id, source: "direct", page: "home" })).rejects.toMatchObject({ status: 503 });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
