import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createVisitLimiter } from "../../src/lib/server/visit-limit";

it("IP별 120건 이후를 거절하고 1분 뒤 다시 허용한다", () => {
  const allow = createVisitLimiter();
  for (let i = 0; i < 120; i++) expect(allow("192.0.2.1", 1000)).toBe(true);
  expect(allow("192.0.2.1", 1001)).toBe(false);
  expect(allow("192.0.2.2", 1001)).toBe(true);
  expect(allow("192.0.2.1", 61_000)).toBe(true);
});
it("제한 메모리의 상한을 지키고 만료한 키를 정리한다", () => {
  const allow = createVisitLimiter(1);
  expect(allow("192.0.2.1", 0)).toBe(true);
  expect(allow("192.0.2.2", 0)).toBe(false);
  expect(allow("192.0.2.2", 60_000)).toBe(true);
});
