import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ApiError, dbError, endpoint, isAllowedAppOrigin, json, requestOrigin } from "../../src/lib/server/http";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

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

it("API 실패의 응답·헤더·로그는 같은 요청 ID를 사용하고 민감한 내용을 기록하지 않는다", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const secret = "synthetic-private-note-and-token";
  const providerError = { code: "42P01", message: secret, details: secret, hint: secret };
  const response = await endpoint(async () => {
    dbError(providerError, "rpc.reserve_uploads");
    return json({});
  }, "/api/uploads")(new Request(`https://app.example/api/uploads?token=${secret}`, {
    headers: { authorization: `Bearer ${secret}`, cookie: `session=${secret}` },
  }));
  const body = await response.json();
  const record = JSON.parse(log.mock.calls[0][0]);
  expect(response.status).toBe(503);
  expect(body.error.request_id).toBe(response.headers.get("X-Request-Id"));
  expect(record).toMatchObject({ request_id: body.error.request_id, operation: "/api/uploads",
    stage: "rpc.reserve_uploads", code: "TEMPORARY_FAILURE", provider_code: "42P01" });
  expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  expect(body.error).not.toHaveProperty("diagnostic");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});

it("일반 예외의 원문과 버전 충돌의 메모 details는 로그에서 제외한다", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const secret = "synthetic-note-original.png-token";
  for (const error of [new TypeError(secret), new ApiError(409, "VERSION_CONFLICT", { current: { note_text: secret } }),
    new ApiError(503, secret, undefined, { stage: "images.transform", cause: { code: secret } })]) {
    await endpoint(async () => { throw error; })(new Request("https://app.example/api/me"));
  }
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ error_type: "TypeError", code: "TEMPORARY_FAILURE" });
  expect(JSON.parse(log.mock.calls[1][0])).toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
  expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
});

it("성공 로그는 응답 데이터를 제외하고 상태와 처리 시간을 남긴다", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const secret = "synthetic-photo-and-note";
  const response = await endpoint(async () => json({ note: secret }), "/api/photos")(new Request("https://app.example/api/photos"));
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ event: "api_request_completed",
    request_id: response.headers.get("X-Request-Id"), operation: "/api/photos", status: 200,
    duration_ms: expect.any(Number) });
  expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
});
