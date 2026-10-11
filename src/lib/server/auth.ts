import "server-only";
import { redirect } from "next/navigation";
import { isConfigured } from "../config";
import { createClient } from "../supabase/server";
import { ApiError, dbError } from "./http";
import { adminClient } from "./admin";

export async function requireUser() {
  if (!isConfigured()) throw new ApiError(503, "NOT_CONFIGURED");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "UNAUTHENTICATED");
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("account_state,analytics_consent,timezone").eq("user_id", data.user.id).maybeSingle();
  dbError(profileError);
  if (!profile) {
    const result = await adminClient().rpc("ensure_profile", { p_user_id: data.user.id });
    // TEMP DIAG: remove after root cause confirmed
    if (result.error) console.error("[diag:ensure_profile] code:", result.error.code, "msg:", result.error.message, "hint:", result.error.hint);
    dbError(result.error);
  } else if (profile.account_state !== "active") throw new ApiError(403, "ACCOUNT_DELETING");
  return { supabase, user: data.user };
}
export async function pageUser() {
  try { return await requireUser(); }
  catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    throw error;
  }
}
