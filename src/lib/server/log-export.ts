import "server-only";
import { createLogWorkbook } from "../log-workbook";
import { accountUsageReport } from "./account-usage";
import { adminClient } from "./admin";
import { dbError } from "./http";

export async function logWorkbook(days: number) {
  const first = await accountUsageReport(days, 1, 50);
  const accounts = [...first.accounts];
  for (let page = first.next_page; page; ) {
    const next = await accountUsageReport(days, page, 50);
    accounts.push(...next.accounts); page = next.next_page;
  }
  const db = adminClient();
  const consenting = accounts.filter(a => a.analytics_consent).map(a => a.id);
  const events: {user_id: string; name: string; occurred_at: string}[] = [];
  const visits: {actor: string; source: string; page: string; occurred_at: string; session_id: string}[] = [];
  if (consenting.length) for (let offset = 0; ; offset += 1000) {
    const batch = await db.from("events").select("user_id,name,occurred_at").in("user_id", consenting)
      .gte("occurred_at", first.since).lte("occurred_at", first.until).order("id").range(offset, offset + 999);
    dbError(batch.error); events.push(...batch.data ?? []);
    if ((batch.data?.length ?? 0) < 1000) break;
  }
  for (let offset = 0; ; offset += 1000) {
    const batch = await db.from("visit_events").select("actor,source,page,occurred_at,session_id")
      .gte("occurred_at", first.since).lte("occurred_at", first.until).order("id").range(offset, offset + 999);
    dbError(batch.error); visits.push(...batch.data ?? []);
    if ((batch.data?.length ?? 0) < 1000) break;
  }
  return createLogWorkbook({accounts, events, visits, since: first.since, until: first.until});
}
