import "server-only";
import { accountReportSchema } from "../analytics";
import { adminClient } from "./admin";
import { requireAnalyticsAdmin } from "./analytics";
import { ApiError, dbError } from "./http";

export async function accountUsageReport(days: number, page: number, pageSize: number) {
  const { user } = await requireAnalyticsAdmin();
  const db = adminClient();
  // Auth 이메일 검사와 기존 DB 관리자 명단을 모두 통과한 뒤에만 계정을 조회합니다.
  const member = await db.from("analytics_administrators").select("user_id").eq("user_id", user.id).maybeSingle();
  dbError(member.error);
  if (!member.data) throw new ApiError(403, "FORBIDDEN");
  const until = new Date();
  const koreanDay = new Date(until.getTime() + 9 * 60 * 60_000).toISOString().slice(0, 10);
  const since = new Date(Date.parse(`${koreanDay}T00:00:00+09:00`) - (days - 1) * 86_400_000).toISOString();
  const listed = await db.auth.admin.listUsers({ page, perPage: pageSize });
  if (listed.error) throw new ApiError(503, "TEMPORARY_FAILURE");
  const users = listed.data.users;
  const ids = users.map(u => u.id);
  const accounts = [];
  if (ids.length) {
    const [profiles, administrators] = await Promise.all([
      db.from("profiles").select("user_id,analytics_consent,account_state").in("user_id", ids),
      db.from("analytics_administrators").select("user_id").in("user_id", ids),
    ]);
    dbError(profiles.error); dbError(administrators.error);
    const counts = new Map(ids.map(id => [id, { photos: 0, preserved: 0, first_notes: 0, second_notes: 0 }]));
    for (let offset = 0; ; offset += 1000) {
      const batch = await db.from("photos").select("user_id,preserved_at,first_note_at,second_note_at")
        .in("user_id", ids).eq("lifecycle", "ready").order("id").range(offset, offset + 999);
      dbError(batch.error);
      for (const row of batch.data ?? []) {
        const count = counts.get(row.user_id)!;
        count.photos++; if (row.preserved_at) count.preserved++;
        if (row.first_note_at) count.first_notes++; if (row.second_note_at) count.second_notes++;
      }
      if ((batch.data?.length ?? 0) < 1000) break;
    }
    const consenting = (profiles.data ?? []).filter(p => p.analytics_consent).map(p => p.user_id);
    const actions = new Map<string, Map<string, { name: string; count: number; last_at: string }>>();
    if (consenting.length) for (let offset = 0; ; offset += 1000) {
      const batch = await db.from("events").select("user_id,name,occurred_at").in("user_id", consenting)
        .gte("occurred_at", since).lte("occurred_at", until.toISOString()).order("id").range(offset, offset + 999);
      dbError(batch.error);
      for (const row of batch.data ?? []) {
        const group = actions.get(row.user_id) ?? new Map();
        const action = group.get(row.name) ?? { name: row.name, count: 0, last_at: row.occurred_at };
        action.count++; if (row.occurred_at > action.last_at) action.last_at = row.occurred_at;
        group.set(row.name, action); actions.set(row.user_id, group);
      }
      if ((batch.data?.length ?? 0) < 1000) break;
    }
    for (const auth of users) {
      const profile = profiles.data?.find(p => p.user_id === auth.id);
      accounts.push({ id: auth.id, email: auth.email ?? null,
        administrator: administrators.data?.some(a => a.user_id === auth.id) ?? false,
        created_at: auth.created_at, last_sign_in_at: auth.last_sign_in_at ?? null,
        account_state: profile?.account_state ?? null, analytics_consent: profile?.analytics_consent ?? null,
        ...counts.get(auth.id)!,
        actions: profile?.analytics_consent ? [...(actions.get(auth.id)?.values() ?? [])].sort((a, b) => a.name.localeCompare(b.name)) : null,
      });
    }
  }
  const total = Math.max(listed.data.total ?? 0, users.length ? (page - 1) * pageSize + users.length : 0);
  return accountReportSchema.parse({ accounts, page, page_size: pageSize, total,
    next_page: page * pageSize < total ? page + 1 : null, since, until: until.toISOString(), days });
}
