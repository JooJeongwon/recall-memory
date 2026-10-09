import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const headers = { "Cache-Control": "private, no-store", "Content-Type": "application/json" };
Deno.serve(async (request) => {
  const secret = Deno.env.get("MAINTENANCE_CALL_SECRET");
  if (request.method !== "POST" || !secret || request.headers.get("Authorization") !== `Bearer ${secret}`)
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers });
  const url = Deno.env.get("SUPABASE_URL");
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
  if (!url || !secretKeys.default)
    return new Response(JSON.stringify({ error: "MAINTENANCE_FAILURE" }), { status: 503, headers });
  const db = createClient(url, secretKeys.default, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  try {
    const sweep = await db.rpc("sweep_incomplete");
    if (sweep.error) throw new Error("DB_FAILURE");
    let processed = 0;
    // ponytail: 실행당 최대 20건. 밀리면 Cron 빈도/배치 크기를 조정합니다.
    for (let i = 0; i < 20; i++) {
      const claimed = await db.rpc("claim_cleanup");
      if (claimed.error) throw new Error("DB_FAILURE");
      const job = claimed.data;
      if (!job?.id) break;
      let errorCode: string | null = null;
      try {
        if (job.kind === "account_delete") {
          // profile 제거 후 FK는 null입니다. 완료 전 dedupe 키는 재시도에 필요한 ID를 유지합니다.
          const userId = job.user_id ?? job.dedupe_key.replace(/^account:/, "");
          const remaining = await db.from("photos").select("id", { count: "exact", head: true })
            .eq("user_id", userId).neq("lifecycle", "deleted");
          if (remaining.error) throw new Error("DB_FAILURE");
          if (remaining.count) {
            const deferred = await db.rpc("defer_cleanup", { p_job_id: job.id, p_lease_token: job.lease_token });
            if (deferred.error) throw new Error("DB_FAILURE");
            continue;
          }
          const purged = await db.rpc("purge_account_data", { p_user_id: userId });
          if (purged.error) throw new Error("DB_FAILURE");
          const user = await db.auth.admin.getUserById(userId);
          if (user.error && user.error.status !== 404) throw new Error("AUTH_FAILURE");
          if (user.data.user) {
            const removed = await db.auth.admin.deleteUser(userId);
            if (removed.error) throw new Error("AUTH_FAILURE");
          }
        } else {
          const photo = await db.from("photos").select("original_key,thumbnail_key,lifecycle")
            .eq("id", job.photo_id).eq("user_id", job.user_id).maybeSingle();
          if (photo.error || !photo.data || photo.data.lifecycle !== "deleting") throw new Error("DB_FAILURE");
          const keys = [photo.data.original_key, photo.data.thumbnail_key].filter(Boolean);
          const removed = await db.storage.from("memory-assets").remove(keys);
          if (removed.error) throw new Error("STORAGE_FAILURE");
        }
      } catch (error) {
        errorCode = error instanceof Error && ["DB_FAILURE", "AUTH_FAILURE", "STORAGE_FAILURE"].includes(error.message)
          ? error.message : "DB_FAILURE";
      }
      const finished = await db.rpc("finish_cleanup", { p_job_id: job.id, p_lease_token: job.lease_token,
        p_success: errorCode === null, p_error_code: errorCode });
      if (finished.error) throw new Error("DB_FAILURE");
      processed++;
    }
    return new Response(JSON.stringify({ processed }), { headers });
  } catch {
    // 사진·메모·객체 키·API 오류 상세를 로그에 기록하지 않습니다.
    return new Response(JSON.stringify({ error: "MAINTENANCE_FAILURE" }), { status: 503, headers });
  }
});
