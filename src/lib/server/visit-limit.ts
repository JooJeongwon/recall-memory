import "server-only";
import { createHash, randomBytes } from "node:crypto";

// Vercel 함수 인스턴스별 단기 제한입니다. IP 원문과 제한 키는 DB·로그에 남기지 않습니다.
export function createVisitLimiter(capacity = 10_000) {
  const salt = randomBytes(32);
  const entries = new Map<string, { count: number; until: number }>();
  return (address: string, now = Date.now()) => {
    for (const [key, entry] of entries) if (entry.until <= now) entries.delete(key);
    const key = createHash("sha256").update(salt).update(address).digest("hex");
    const entry = entries.get(key);
    if (entry) {
      if (entry.count >= 120) return false;
      entry.count += 1;
    } else {
      if (entries.size >= capacity) return false;
      entries.set(key, { count: 1, until: now + 60_000 });
    }
    return true;
  };
}
export const allowVisit = createVisitLimiter();
