import { afterEach, expect, it, vi } from "vitest";
import { requestApi, RequestError } from "../../src/lib/api";

afterEach(() => vi.unstubAllGlobals());

it("실패한 API 요청 ID를 업로드 화면까지 전달한다", async () => {
  const requestId = "45acbfb7-9efb-4dd8-8a90-f7c039306526";
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: {
    code: "TEMPORARY_FAILURE", message: "잠시 후 다시 시도해주세요.", request_id: requestId,
  } }, { status: 503 })));
  await expect(requestApi("/api/uploads")).rejects.toBeInstanceOf(RequestError);
  await expect(requestApi("/api/uploads")).rejects.toMatchObject({ requestId, code: "TEMPORARY_FAILURE" });
});
