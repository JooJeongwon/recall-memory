import "server-only";
import { adminClient } from "./admin";
import { createClient } from "../supabase/server";
import { requireUser } from "./auth";
import { ApiError, dbError } from "./http";
import { analyticsReportSchema, type Visit } from "../analytics";

const administrators = ["jwjoo0512@gmail.com", "elice0105412@gmail.com"];
export function isAnalyticsAdmin(user: { email?: string; email_confirmed_at?: string }) {
  return !!user.email_confirmed_at && administrators.includes(user.email?.toLowerCase() ?? "");
}
export async function requireAnalyticsAdmin() {
  const auth = await requireUser();
  if (!isAnalyticsAdmin(auth.user)) throw new ApiError(403, "FORBIDDEN");
  return auth;
}
export async function recordVisit(visit: Visit) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error && ![400, 401, 403].includes(error.status ?? 0)) throw new ApiError(503, "TEMPORARY_FAILURE");
  const { error: recordError } = await adminClient().rpc("record_visit", {
    p_event_id: visit.event_id, p_session_id: visit.session_id, p_source: visit.source, p_page: visit.page,
    ...(data.user ? { p_user_id: data.user.id } : {}),
  });
  dbError(recordError);
}
export async function analyticsReport(days: number) {
  const { user } = await requireAnalyticsAdmin();
  const { data, error } = await adminClient().rpc("analytics_report", { p_admin_id: user.id, p_days: days });
  dbError(error);
  return analyticsReportSchema.parse(data);
}
