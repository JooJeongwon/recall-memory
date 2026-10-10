import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { policy } from "../../src/lib/config";
import { photoSchema } from "../../src/lib/validation/contracts";
import type { Database } from "../../src/types/database";

export function createTestData() {
  const url = process.env.INTEGRATION_SUPABASE_URL;
  const key = process.env.INTEGRATION_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.INTEGRATION_SUPABASE_SECRET_KEY;
  const projectId = process.env.INTEGRATION_SUPABASE_PROJECT_ID;
  if (!url || !key || !secret || !projectId || new URL(url).origin !== `https://${projectId}.supabase.co`)
    throw new Error("통합 검증에는 URL과 ID가 일치하는 전용 개발 Supabase 프로젝트를 명시해야 합니다.");
  const admin = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const userIds: string[] = [];
  const jobIds: string[] = [];
  const extraKeys: string[] = [];

  async function createUser() {
    const email = `test-${crypto.randomUUID()}@example.test`;
    const password = `${crypto.randomUUID()}Aa1!`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.equal(created.error, null);
    const id = created.data.user!.id;
    userIds.push(id);
    assert.equal((await admin.rpc("ensure_profile", { p_user_id: id })).error, null);
    const client = createClient<Database>(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await client.auth.signInWithPassword({ email, password });
    assert.equal(signedIn.error, null);
    return { id, client, session: signedIn.data.session! };
  }

  async function readyPhoto(user: Awaited<ReturnType<typeof createUser>>) {
    const original = await sharp({ create: { width: 2, height: 2, channels: 4, background: "#fa0" } }).png().toBuffer();
    const reserved = await admin.rpc("reserve_uploads", { p_user_id: user.id, p_files: [{
      original_name: "synthetic.png", mime_type: "image/png", byte_size: original.length,
      client_request_id: crypto.randomUUID(),
    }] });
    assert.equal(reserved.error, null);
    const reservation = (reserved.data as unknown as Array<{ id: string; original_key: string; thumbnail_key: string }>)[0];
    const uploaded = await user.client.storage.from(policy.bucket).upload(reservation.original_key,
      new Blob([Uint8Array.from(original)], { type: "image/png" }), { contentType: "image/png", upsert: false, cacheControl: "0" });
    assert.equal(uploaded.error, null);
    const claimed = await admin.rpc("claim_upload", { p_user_id: user.id, p_photo_id: reservation.id });
    assert.equal(claimed.error, null);
    const token = (claimed.data as { token: string }).token;
    const thumbnail = await sharp(original).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 }).toBuffer();
    assert.equal((await admin.storage.from(policy.bucket).upload(reservation.thumbnail_key, thumbnail,
      { contentType: "image/webp", upsert: true, cacheControl: "0" })).error, null);
    const completed = await admin.rpc("complete_upload", { p_user_id: user.id, p_photo_id: reservation.id,
      p_token: token, p_width: 2, p_height: 2, p_bytes: original.length, p_mime: "image/png" });
    assert.equal(completed.error, null);
    return { photo: photoSchema.parse(completed.data), original,
      originalKey: reservation.original_key, thumbnailKey: reservation.thumbnail_key };
  }

  async function cleanup() {
    const failures: unknown[] = [];
    function check(result: { error: unknown }) { if (result.error) failures.push(result.error); }
    // 실패한 테스트도 나머지 합성 계정 정리를 끝낸 뒤 정리 오류를 보고합니다.
    for (const id of userIds) {
      const photos = await admin.from("photos").select("original_key,thumbnail_key").eq("user_id", id);
      check(photos);
      const keys = (photos.data ?? []).flatMap((photo) => [photo.original_key, photo.thumbnail_key]
        .filter((value): value is string => Boolean(value)));
      if (keys.length) check(await admin.storage.from(policy.bucket).remove(keys));
      check(await admin.from("cleanup_jobs").delete().eq("user_id", id));
      check(await admin.from("events").delete().eq("user_id", id));
      check(await admin.from("photos").delete().eq("user_id", id));
      check(await admin.from("trials").delete().eq("user_id", id));
      check(await admin.from("profiles").delete().eq("user_id", id));
      check(await admin.auth.admin.deleteUser(id));
    }
    if (extraKeys.length) check(await admin.storage.from(policy.bucket).remove(extraKeys));
    if (jobIds.length) check(await admin.from("cleanup_jobs").delete().in("id", jobIds));
    assert.equal(failures.length, 0, "합성 테스트 데이터 정리에 실패했습니다.");
  }
  return { admin, url, key, projectId, createUser, readyPhoto, cleanup, jobIds, extraKeys };
}
