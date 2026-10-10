import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { adminClient } from "./admin";
import { requireUser } from "./auth";
import { ApiError, dbError } from "./http";
import { rpc } from "./photos";

export async function deleteAccount() {
  const auth = await requireUser();
  const { supabase } = auth;
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const job = await rpc("request_account_delete", { p_token_hash: hash }, auth);
  if (!job) throw new ApiError(503, "TEMPORARY_FAILURE");
  // DB 차단이 먼저 확정됐으며 로그아웃 실패에도 삭제 작업은 계속됩니다.
  await supabase.auth.signOut({ scope: "global" });
  return { job_id: job.id, status: job.status, progress_token: token, expires_at: job.progress_expires_at };
}
export async function deletionStatus(request: Request, id: string) {
  z.uuid().parse(id);
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const { data: job, error } = await adminClient().from("cleanup_jobs")
    .select("user_id,status,progress_token_hash,progress_expires_at").eq("id", id).maybeSingle();
  dbError(error);
  if (!job) throw new ApiError(404, "NOT_FOUND");
  if (token) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !job.progress_expires_at ||
      Date.now() >= Date.parse(job.progress_expires_at) ||
      !job.progress_token_hash || !timingSafeEqual(createHash("sha256").update(token).digest(),
        Buffer.from(job.progress_token_hash, "hex"))) throw new ApiError(404, "NOT_FOUND");
  } else {
    const { user } = await requireUser();
    if (job.user_id !== user.id) throw new ApiError(404, "NOT_FOUND");
  }
  return { status: job.status === "done" ? "done" : job.status === "failed" ? "failed" : "pending" };
}
