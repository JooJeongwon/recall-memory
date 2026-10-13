import { z } from "zod";

export const visitStorageKey = "recall-visit";
export const sessionMinutes = 30;
export const visitInput = z.object({
  event_id: z.uuid(), session_id: z.uuid(),
  source: z.enum(["qr", "direct", "referral", "unknown"]),
  page: z.enum(["home", "login", "start", "revisit", "photo", "edit", "memories", "settings", "deletion"]),
}).strict();
export type Visit = z.infer<typeof visitInput>;
const sessionSchema = z.object({ id: z.uuid(), source: visitInput.shape.source, last: z.number() });

export function visitPage(path: string): Visit["page"] | null {
  const pages: Record<string, Visit["page"]> = { "/": "home", "/login": "login", "/start": "start", "/revisit": "revisit", "/memories": "memories", "/settings": "settings", "/settings/deletion": "deletion" };
  if (pages[path]) return pages[path];
  if (/^\/photos\/[0-9a-f-]{36}$/i.test(path)) return "photo";
  if (/^\/photos\/[0-9a-f-]{36}\/edit$/i.test(path)) return "edit";
  return null;
}

export function nextVisit(page: Visit["page"], url: URL, referrer: string, stored: string | null, now: number): Visit & { session: string } {
  let previous;
  try { previous = sessionSchema.parse(JSON.parse(stored ?? "null")); } catch { /* 잘못된 저장값은 새 방문으로 처리합니다. */ }
  let source: Visit["source"] = "direct";
  try { if (referrer && new URL(referrer).origin !== url.origin) source = "referral"; } catch { source = "unknown"; }
  if (url.searchParams.get("source") === "qr") source = "qr";
  const current = previous && now >= previous.last && now - previous.last < sessionMinutes * 60_000 &&
    !(url.searchParams.get("source") === "qr" && previous.source !== "qr") ? previous : { id: crypto.randomUUID(), source };
  const { id } = current;
  source = current.source;
  return { event_id: crypto.randomUUID(), session_id: id, source, page, session: JSON.stringify({ id, source, last: now }) };
}

export const analyticsReportSchema = z.object({
  since: z.string(), until: z.string(), days: z.number(),
  pageviews: z.number(), sessions: z.number(), visitor_sessions: z.number(), account_sessions: z.number(), participant_sessions: z.number(),
  consenting_active_accounts: z.number(), registered_accounts: z.number(), participating_accounts: z.number(), consented_accounts: z.number(),
  sources: z.array(z.object({ source: visitInput.shape.source, sessions: z.number(), visitor_sessions: z.number(), account_sessions: z.number(), participant_sessions: z.number() })),
  daily: z.array(z.object({ day: z.string(), pageviews: z.number(), sessions: z.number(), consenting_accounts: z.number() })),
  actions: z.array(z.object({ name: z.string(), events: z.number(), accounts: z.number() })),
});
export type AnalyticsReport = z.infer<typeof analyticsReportSchema>;

export const accountUsageSchema = z.object({
  id: z.uuid(), email: z.string().nullable(), administrator: z.boolean(),
  created_at: z.string(), last_sign_in_at: z.string().nullable(),
  account_state: z.string().nullable(), analytics_consent: z.boolean().nullable(),
  photos: z.number(), preserved: z.number(), first_notes: z.number(), second_notes: z.number(),
  actions: z.array(z.object({ name: z.string(), count: z.number(), last_at: z.string() })).nullable(),
});
export const accountReportSchema = z.object({
  accounts: z.array(accountUsageSchema), page: z.number(), page_size: z.number(),
  total: z.number(), next_page: z.number().nullable(), since: z.string(), until: z.string(), days: z.number(),
});
export type AccountReport = z.infer<typeof accountReportSchema>;
