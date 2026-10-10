import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { expect, it } from "vitest";
import { policy } from "../../src/lib/config";
import type { Database } from "../../src/types/database";

it("격리된 개발 Supabase에서 권한과 합성 사진 보관 흐름을 확인한다", async () => {
  const url = process.env.INTEGRATION_SUPABASE_URL;
  const key = process.env.INTEGRATION_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.INTEGRATION_SUPABASE_SECRET_KEY;
  const projectId = process.env.INTEGRATION_SUPABASE_PROJECT_ID;
  if (!url || !key || !secret || !projectId || new URL(url).origin !== `https://${projectId}.supabase.co`)
    throw new Error("통합 검증에는 URL과 ID가 일치하는 전용 개발 Supabase 프로젝트를 명시해야 합니다.");
  const admin = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const beforeSweep = new Date().toISOString();
  const staleUploads = await admin.from("photos").select("id", { count: "exact", head: true })
    .in("lifecycle", ["uploading", "failed"]).lt("upload_deadline_at", beforeSweep).is("preserved_at", null);
  expect(staleUploads.error).toBeNull(); expect(staleUploads.count).toBe(0);
  const expiredAccountJobs = await admin.from("cleanup_jobs").select("id", { count: "exact", head: true })
    .eq("kind", "account_delete").eq("status", "done").lt("progress_expires_at", beforeSweep);
  expect(expiredAccountJobs.error).toBeNull(); expect(expiredAccountJobs.count).toBe(0);
  const userIds: string[] = [];
  let photoId: string | undefined;
  let cleanupJobId: string | undefined;
  let retryCleanupJobId: string | undefined;
  let pendingPhotoId: string | undefined;
  let originalKey: string | undefined;
  let thumbnailKey: string | undefined;
  let lateNotePhotoId: string | undefined;
  let lateNoteOriginalKey: string | undefined;
  let lateNoteThumbnailKey: string | undefined;
  let unreservedUploadKey: string | undefined;
  try {
    const dbPolicy = await admin.rpc("app_policy");
    expect(dbPolicy.error).toBeNull(); expect(dbPolicy.data).toEqual(policy);
    const sessions = [];
    for (const label of ["a", "b"]) {
      const email = `test-${label}-${crypto.randomUUID()}@example.test`;
      const password = `${crypto.randomUUID()}Aa1!`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      expect(created.error).toBeNull();
      const id = created.data.user!.id; userIds.push(id);
      expect((await admin.rpc("ensure_profile", { p_user_id: id })).error).toBeNull();
      const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull();
      sessions.push(client);
    }
    const b = await sessions[1].from("profiles").select("user_id");
    expect(b.error).toBeNull(); expect(b.data?.map((p) => p.user_id)).toEqual([userIds[1]]);
    expect((await sessions[0].from("profiles").update({ analytics_consent: true }).eq("user_id", userIds[0])).error).not.toBeNull();
    expect((await sessions[0].rpc("ensure_profile", { p_user_id: userIds[1] })).error).not.toBeNull();
    const anonymous = createClient<Database>(url, key);
    expect((await anonymous.from("photos").select("id")).error).not.toBeNull();
    expect((await anonymous.rpc("claim_cleanup")).error).not.toBeNull();

    const original = await sharp({ create: { width: 2, height: 2, channels: 4, background: "#fa0" } }).png().toBuffer();
    const requestId = crypto.randomUUID();
    const file = { original_name: "synthetic.png", mime_type: "image/png", byte_size: original.length,
      client_request_id: requestId };
    const reservedResult = await admin.rpc("reserve_uploads", { p_user_id: userIds[0], p_files: [{
      ...file,
    }] });
    expect(reservedResult.error).toBeNull();
    const reservation = (reservedResult.data as unknown as Array<{
      id: string; original_key: string; thumbnail_key: string;
    }>)[0];
    photoId = reservation.id;
    originalKey = reservation.original_key;
    thumbnailKey = reservation.thumbnail_key;
    const duplicateReservation = await admin.rpc("reserve_uploads", { p_user_id: userIds[0], p_files: [file] });
    expect(duplicateReservation.error).toBeNull();
    expect((duplicateReservation.data as unknown as Array<{ id: string }>)).toMatchObject([{ id: photoId }]);
    const mismatchedRetry = await admin.rpc("reserve_uploads", { p_user_id: userIds[0], p_files: [{ ...file, original_name: "changed.png" }] });
    expect(mismatchedRetry.error?.message).toBe("INVALID_INPUT");

    unreservedUploadKey = `${userIds[0]}/${crypto.randomUUID()}/original.png`;
    const unreservedUpload = await sessions[0].storage.from(policy.bucket).upload(unreservedUploadKey,
      new Blob([Uint8Array.from(original)], { type: "image/png" }), { contentType: "image/png", upsert: false });
    expect(unreservedUpload.error).not.toBeNull();

    const limitBatch = (count: number) => Array.from({ length: count }, () => ({
      original_name: `limit-${crypto.randomUUID()}.png`, mime_type: "image/png", byte_size: original.length,
      client_request_id: crypto.randomUUID(),
    }));
    const firstLimitBatch = await admin.rpc("reserve_uploads", { p_user_id: userIds[1], p_files: limitBatch(10) });
    expect(firstLimitBatch.error).toBeNull();
    expect(firstLimitBatch.data).toHaveLength(10);
    const secondLimitBatch = await admin.rpc("reserve_uploads", { p_user_id: userIds[1], p_files: limitBatch(10) });
    expect(secondLimitBatch.error).toBeNull();
    expect(secondLimitBatch.data).toHaveLength(10);
    const overLimit = await admin.rpc("reserve_uploads", { p_user_id: userIds[1], p_files: limitBatch(1) });
    expect(overLimit.error?.message).toBe("LIMIT_EXCEEDED");
    const userBCount = await admin.from("photos").select("id", { count: "exact", head: true }).eq("user_id", userIds[1]);
    expect(userBCount.count).toBe(20);

    const unauthorizedUpload = await sessions[1].storage.from(policy.bucket).upload(originalKey,
      new Blob([Uint8Array.from(original)], { type: "image/png" }), { contentType: "image/png", upsert: false });
    expect(unauthorizedUpload.error).not.toBeNull();
    const uploaded = await sessions[0].storage.from(policy.bucket).upload(originalKey,
      new Blob([Uint8Array.from(original)], { type: "image/png" }),
      { contentType: "image/png", upsert: false, cacheControl: "0" });
    expect(uploaded.error).toBeNull();
    const storedOriginal = await admin.storage.from(policy.bucket).download(originalKey);
    expect(storedOriginal.error).toBeNull();
    expect(Buffer.from(await storedOriginal.data!.arrayBuffer()).equals(original)).toBe(true);

    const claimResult = await admin.rpc("claim_upload", { p_user_id: userIds[0], p_photo_id: photoId });
    expect(claimResult.error).toBeNull();
    const claim = claimResult.data as unknown as { already_ready: boolean; token: string; photo: { thumbnail_key: string } };
    expect(claim.already_ready).toBe(false);
    const thumbnail = await sharp(original).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 }).toBuffer();
    expect((await admin.storage.from(policy.bucket).upload(claim.photo.thumbnail_key, thumbnail,
      { contentType: "image/webp", upsert: true, cacheControl: "0" })).error).toBeNull();
    const completed = await admin.rpc("complete_upload", { p_user_id: userIds[0], p_photo_id: photoId,
      p_token: claim.token, p_width: 2, p_height: 2, p_bytes: original.length, p_mime: "image/png" });
    expect(completed.error).toBeNull();
    const startedTrial = await admin.from("trials").select("started_at,ends_at,duration_hours")
      .eq("user_id", userIds[0]).single();
    expect(startedTrial.error).toBeNull();
    expect(startedTrial.data?.started_at).not.toBeNull();
    expect(startedTrial.data?.ends_at).not.toBeNull();
    expect(Date.parse(startedTrial.data!.ends_at!) - Date.parse(startedTrial.data!.started_at!))
      .toBe(startedTrial.data!.duration_hours * 60 * 60 * 1_000);

    const emptyFirstNote = await admin.rpc("save_note", { p_user_id: userIds[0], p_photo_id: photoId,
      p_note_text: " \n ", p_expected_version: 1, p_request_id: crypto.randomUUID() });
    expect(emptyFirstNote.error?.message).toBe("INVALID_INPUT");
    const maxLengthNote = await admin.rpc("save_note", { p_user_id: userIds[0], p_photo_id: photoId,
      p_note_text: "📷".repeat(500), p_expected_version: 1, p_request_id: crypto.randomUUID() });
    expect(maxLengthNote.error).toBeNull();
    expect(maxLengthNote.data).toMatchObject({ note_text: "📷".repeat(500), version: 2 });
    const overLengthNote = await admin.rpc("save_note", { p_user_id: userIds[0], p_photo_id: photoId,
      p_note_text: "📷".repeat(501), p_expected_version: 2, p_request_id: crypto.randomUUID() });
    expect(overLengthNote.error?.message).toBe("INVALID_INPUT");
    const saved = await admin.rpc("save_note", { p_user_id: userIds[0], p_photo_id: photoId,
      p_note_text: "합성 사진 보관 확인", p_expected_version: 2, p_request_id: crypto.randomUUID() });
    expect(saved.error).toBeNull();
    const ownPhoto = await sessions[0].from("photos").select("note_text,preserved_at").eq("id", photoId);
    expect(ownPhoto.error).toBeNull();
    expect(ownPhoto.data).toHaveLength(1);
    expect(ownPhoto.data?.[0].note_text).toBe("합성 사진 보관 확인");
    expect(ownPhoto.data?.[0].preserved_at).not.toBeNull();
    const firstNote = await admin.from("photos").select("first_note_at").eq("id", photoId).single();
    expect(firstNote.error).toBeNull();
    expect(firstNote.data?.first_note_at).not.toBeNull();
    expect(Date.parse(firstNote.data!.first_note_at!)).toBeLessThanOrEqual(Date.parse(startedTrial.data!.ends_at!));
    const hiddenPhoto = await sessions[1].from("photos").select("id").eq("id", photoId);
    expect(hiddenPhoto.error).toBeNull();
    expect(hiddenPhoto.data).toEqual([]);

    const ownerAsset = await sessions[0].storage.from(policy.bucket).download(originalKey);
    expect(ownerAsset.error).toBeNull();
    expect(Buffer.from(await ownerAsset.data!.arrayBuffer()).equals(original)).toBe(true);
    const otherUserAsset = await sessions[1].storage.from(policy.bucket).download(originalKey);
    expect(otherUserAsset.error).not.toBeNull();

    const lateNoteReservation = await admin.rpc("reserve_uploads", { p_user_id: userIds[0], p_files: [{
      original_name: "late-note.png", mime_type: "image/png", byte_size: original.length,
      client_request_id: crypto.randomUUID(),
    }] });
    expect(lateNoteReservation.error).toBeNull();
    const lateNotePhoto = (lateNoteReservation.data as unknown as Array<{
      id: string; original_key: string; thumbnail_key: string;
    }>)[0];
    lateNotePhotoId = lateNotePhoto.id;
    lateNoteOriginalKey = lateNotePhoto.original_key;
    lateNoteThumbnailKey = lateNotePhoto.thumbnail_key;
    const lateNoteUploaded = await sessions[0].storage.from(policy.bucket).upload(lateNoteOriginalKey,
      new Blob([Uint8Array.from(original)], { type: "image/png" }),
      { contentType: "image/png", upsert: false, cacheControl: "0" });
    expect(lateNoteUploaded.error).toBeNull();
    const lateNoteClaim = await admin.rpc("claim_upload", { p_user_id: userIds[0], p_photo_id: lateNotePhotoId });
    expect(lateNoteClaim.error).toBeNull();
    const lateNoteToken = (lateNoteClaim.data as { token: string; photo: { thumbnail_key: string } }).token;
    const lateNoteThumbnail = await sharp(original).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 }).toBuffer();
    expect((await admin.storage.from(policy.bucket).upload(lateNoteThumbnailKey, lateNoteThumbnail,
      { contentType: "image/webp", upsert: true, cacheControl: "0" })).error).toBeNull();
    const lateNoteReady = await admin.rpc("complete_upload", { p_user_id: userIds[0], p_photo_id: lateNotePhotoId,
      p_token: lateNoteToken, p_width: 2, p_height: 2, p_bytes: original.length, p_mime: "image/png" });
    expect(lateNoteReady.error).toBeNull();

    const photoTiming = await admin.from("photos").select("ready_at").eq("id", photoId).single();
    const readyAt = photoTiming.data?.ready_at;
    if (!readyAt) throw new Error("Photo ready time missing after upload");
    const pendingResult = await admin.rpc("reserve_uploads", { p_user_id: userIds[0], p_files: [{
      original_name: "pending.png", mime_type: "image/png", byte_size: original.length,
      client_request_id: crypto.randomUUID(),
    }, {
      original_name: "late-claim.png", mime_type: "image/png", byte_size: original.length,
      client_request_id: crypto.randomUUID(),
    }, {
      original_name: "expired-uploading.png", mime_type: "image/png", byte_size: original.length,
      client_request_id: crypto.randomUUID(),
    }, {
      original_name: "expired-failed.png", mime_type: "image/png", byte_size: original.length,
      client_request_id: crypto.randomUUID(),
    }] });
    expect(pendingResult.error).toBeNull();
    const pendingPhotos = pendingResult.data as unknown as Array<{ id: string }>;
    pendingPhotoId = pendingPhotos[0].id;
    const lateClaimPhotoId = pendingPhotos[1].id;
    const expiredUploadingPhotoId = pendingPhotos[2].id;
    const expiredFailedPhotoId = pendingPhotos[3].id;
    const claimBeforeExpiry = await admin.rpc("claim_upload", { p_user_id: userIds[0], p_photo_id: pendingPhotoId });
    expect(claimBeforeExpiry.error).toBeNull();
    const validationToken = (claimBeforeExpiry.data as { token: string }).token;
    const endsAt = new Date(Date.parse(readyAt) - 1_000).toISOString();
    const startedAt = new Date(Date.parse(endsAt) - 48 * 60 * 60 * 1_000).toISOString();
    expect(Date.parse(endsAt)).toBeGreaterThan(Date.parse(startedAt));
    expect((await admin.from("trials").update({ started_at: startedAt, ends_at: endsAt })
      .eq("user_id", userIds[0])).error).toBeNull();
    const state = await admin.rpc("me_state", { p_user_id: userIds[0] });
    expect(state.error).toBeNull();
    expect(state.data).toMatchObject({ can_upload: false, trial_state: "ended" });
    const rejected = await admin.rpc("reserve_uploads", { p_user_id: userIds[0], p_files: [{
      original_name: "after-expiry.png", mime_type: "image/png", byte_size: original.length,
      client_request_id: crypto.randomUUID(),
    }] });
    expect(rejected.error?.message).toBe("TRIAL_ENDED");
    const lateComplete = await admin.rpc("complete_upload", { p_user_id: userIds[0], p_photo_id: pendingPhotoId,
      p_token: validationToken, p_width: 2, p_height: 2, p_bytes: original.length, p_mime: "image/png" });
    expect(lateComplete.error).toBeNull();
    expect(lateComplete.data).toMatchObject({ error: "TRIAL_ENDED" });
    const lateClaim = await admin.rpc("claim_upload", { p_user_id: userIds[0], p_photo_id: lateClaimPhotoId });
    expect(lateClaim.error).toBeNull();
    expect(lateClaim.data).toMatchObject({ error: "TRIAL_ENDED" });
    const lateFirstNote = await admin.rpc("save_note", { p_user_id: userIds[0], p_photo_id: lateNotePhotoId,
      p_note_text: "기간 종료 후 처음 보관한 합성 사진", p_expected_version: 1, p_request_id: crypto.randomUUID() });
    expect(lateFirstNote.error).toBeNull();
    expect(lateFirstNote.data).toMatchObject({ note_text: "기간 종료 후 처음 보관한 합성 사진" });
    const lateFirstNoteAt = Date.parse((lateFirstNote.data as { first_note_at: string }).first_note_at);
    expect(lateFirstNoteAt).toBeGreaterThan(Date.parse(endsAt));
    expect(Date.parse((lateFirstNote.data as { preserved_at: string }).preserved_at)).toBeGreaterThan(Date.parse(endsAt));
    const deletingPhotos = await admin.from("photos").select("lifecycle")
      .in("id", [pendingPhotoId, lateClaimPhotoId]);
    expect(deletingPhotos.data).toHaveLength(2);
    expect(deletingPhotos.data?.every(({ lifecycle }) => lifecycle === "deleting")).toBe(true);
    const expiredDeadline = new Date(Date.now() - 60_000).toISOString();
    const overdueFixtures = await admin.from("photos").update({ upload_deadline_at: expiredDeadline })
      .in("id", [photoId, lateNotePhotoId, expiredUploadingPhotoId, expiredFailedPhotoId]);
    expect(overdueFixtures.error).toBeNull();
    expect((await admin.from("photos").update({ lifecycle: "failed" }).eq("id", expiredFailedPhotoId)).error).toBeNull();
    expect((await admin.rpc("sweep_incomplete")).error).toBeNull();
    const sweptPhotos = await admin.from("photos").select("id,lifecycle").in("id", [
      photoId, lateNotePhotoId, expiredUploadingPhotoId, expiredFailedPhotoId,
    ]);
    expect(sweptPhotos.error).toBeNull();
    expect(sweptPhotos.data).toHaveLength(4);
    expect(sweptPhotos.data?.filter(({ id }) => [expiredUploadingPhotoId, expiredFailedPhotoId].includes(id))
      .every(({ lifecycle }) => lifecycle === "deleting")).toBe(true);
    expect(sweptPhotos.data?.filter(({ id }) => [photoId, lateNotePhotoId].includes(id))
      .every(({ lifecycle }) => lifecycle === "ready")).toBe(true);
    const sweptJobs = await admin.from("cleanup_jobs").select("photo_id,kind,status")
      .in("photo_id", [expiredUploadingPhotoId, expiredFailedPhotoId]);
    expect(sweptJobs.error).toBeNull(); expect(sweptJobs.data).toHaveLength(2);
    expect(sweptJobs.data?.every(({ kind, status }) => kind === "incomplete_upload" && status === "pending")).toBe(true);
    const readyJobs = await admin.from("cleanup_jobs").select("id").in("photo_id", [photoId, lateNotePhotoId]);
    expect(readyJobs.error).toBeNull(); expect(readyJobs.data).toEqual([]);
    const version = await sessions[0].from("photos").select("version").eq("id", photoId).single();
    expect(version.error).toBeNull();
    const currentVersion = version.data?.version;
    if (!currentVersion) throw new Error("Photo version missing after preservation");
    const savedAfterExpiry = await admin.rpc("save_note", { p_user_id: userIds[0], p_photo_id: photoId,
      p_note_text: "기간이 끝나도 기존 사진은 이용할 수 있어요", p_expected_version: currentVersion,
      p_request_id: crypto.randomUUID() });
    expect(savedAfterExpiry.error).toBeNull();
    const stillPreserved = await sessions[0].from("photos").select("lifecycle,note_text,preserved_at")
      .eq("id", photoId).single();
    expect(stillPreserved.data).toMatchObject({ lifecycle: "ready", note_text: "기간이 끝나도 기존 사진은 이용할 수 있어요" });
    expect(stillPreserved.data?.preserved_at).not.toBeNull();
    expect((await sessions[0].from("photos").select("first_note_at").eq("id", photoId).single()).data?.first_note_at)
      .toBe(firstNote.data?.first_note_at);
    const afterExpiryAsset = await sessions[0].storage.from(policy.bucket).download(originalKey);
    expect(afterExpiryAsset.error).toBeNull();
    expect(Buffer.from(await afterExpiryAsset.data!.arrayBuffer()).equals(original)).toBe(true);

    const deleteRequest = await admin.rpc("queue_photo_delete", { p_user_id: userIds[0], p_photo_id: photoId });
    expect(deleteRequest.error).toBeNull();
    cleanupJobId = (deleteRequest.data as { id: string }).id;
    const duplicateDeleteRequest = await admin.rpc("queue_photo_delete", { p_user_id: userIds[0], p_photo_id: photoId });
    expect(duplicateDeleteRequest.error).toBeNull();
    expect((duplicateDeleteRequest.data as { id: string }).id).toBe(cleanupJobId);
    const deleteJobCount = await admin.from("cleanup_jobs").select("id", { count: "exact", head: true })
      .eq("dedupe_key", `photo:${photoId}`);
    expect(deleteJobCount.count).toBe(1);
    expect((await sessions[0].from("photos").select("id").eq("id", photoId)).data).toEqual([]);

    expect((await admin.from("cleanup_jobs").update({ run_after: new Date(Date.now() - 1_000).toISOString() })
      .eq("id", cleanupJobId)).error).toBeNull();
    const deleteClaim = await admin.rpc("claim_cleanup");
    expect(deleteClaim.error).toBeNull();
    expect(deleteClaim.data).toMatchObject({ id: cleanupJobId, status: "running", attempts: 1 });
    const leaseToken = (deleteClaim.data as { lease_token: string }).lease_token;
    expect((await admin.storage.from(policy.bucket).remove([originalKey, thumbnailKey])).error).toBeNull();
    expect((await admin.storage.from(policy.bucket).download(originalKey)).error).not.toBeNull();
    const finishDelete = await admin.rpc("finish_cleanup", {
      p_job_id: cleanupJobId, p_lease_token: leaseToken, p_success: true,
    });
    expect(finishDelete.error).toBeNull();
    const deletedPhoto = await admin.from("photos").select("lifecycle,note_text,original_name,preserved_at,first_note_at")
      .eq("id", photoId).single();
    expect(deletedPhoto.error).toBeNull();
    expect(deletedPhoto.data).toMatchObject({
      lifecycle: "deleted", note_text: "", original_name: "", preserved_at: null, first_note_at: null,
    });
    const finishedJob = await admin.from("cleanup_jobs").select("status,user_id,photo_id,dedupe_key")
      .eq("id", cleanupJobId).single();
    expect(finishedJob.error).toBeNull();
    expect(finishedJob.data).toMatchObject({
      status: "done", user_id: null, photo_id: null, dedupe_key: `done:${cleanupJobId}`,
    });

    const retryRequest = await admin.rpc("queue_photo_delete", {
      p_user_id: userIds[0], p_photo_id: lateNotePhotoId,
    });
    expect(retryRequest.error).toBeNull();
    retryCleanupJobId = (retryRequest.data as { id: string }).id;
    expect((await admin.from("cleanup_jobs").update({ run_after: new Date(Date.now() - 1_000).toISOString() })
      .eq("id", retryCleanupJobId)).error).toBeNull();
    const firstRetryClaim = await admin.rpc("claim_cleanup");
    expect(firstRetryClaim.error).toBeNull();
    expect(firstRetryClaim.data).toMatchObject({ id: retryCleanupJobId, status: "running", attempts: 1 });
    const firstLease = (firstRetryClaim.data as { lease_token: string }).lease_token;
    expect((await admin.rpc("finish_cleanup", {
      p_job_id: retryCleanupJobId, p_lease_token: firstLease, p_success: false, p_error_code: "STORAGE_FAILURE",
    })).error).toBeNull();
    const retryState = await admin.from("cleanup_jobs").select("status,attempts,error_code")
      .eq("id", retryCleanupJobId).single();
    expect(retryState.data).toEqual({ status: "retry", attempts: 1, error_code: "STORAGE_FAILURE" });
    expect((await admin.storage.from(policy.bucket).download(lateNoteOriginalKey)).error).toBeNull();
    expect((await admin.rpc("finish_cleanup", {
      p_job_id: retryCleanupJobId, p_lease_token: firstLease, p_success: true,
    })).error).not.toBeNull();
    expect((await admin.from("cleanup_jobs").update({ run_after: new Date(Date.now() - 1_000).toISOString() })
      .eq("id", retryCleanupJobId)).error).toBeNull();
    const secondRetryClaim = await admin.rpc("claim_cleanup");
    expect(secondRetryClaim.error).toBeNull();
    expect(secondRetryClaim.data).toMatchObject({ id: retryCleanupJobId, status: "running", attempts: 2 });
    const secondLease = (secondRetryClaim.data as { lease_token: string }).lease_token;
    expect(secondLease).not.toBe(firstLease);
    expect((await admin.storage.from(policy.bucket).remove([lateNoteOriginalKey, lateNoteThumbnailKey])).error)
      .toBeNull();
    expect((await admin.rpc("finish_cleanup", {
      p_job_id: retryCleanupJobId, p_lease_token: secondLease, p_success: true,
    })).error).toBeNull();
    const retryPhoto = await admin.from("photos").select("lifecycle,note_text,preserved_at")
      .eq("id", lateNotePhotoId).single();
    expect(retryPhoto.data).toMatchObject({ lifecycle: "deleted", note_text: "", preserved_at: null });
    expect((await admin.from("cleanup_jobs").select("status").eq("id", retryCleanupJobId).single()).data?.status)
      .toBe("done");
  } finally {
    const keys = [originalKey, thumbnailKey, lateNoteOriginalKey, lateNoteThumbnailKey]
      .filter((key): key is string => Boolean(key));
    if (unreservedUploadKey) keys.push(unreservedUploadKey);
    if (keys.length) await admin.storage.from(policy.bucket).remove(keys);
    if (cleanupJobId) await admin.from("cleanup_jobs").delete().eq("id", cleanupJobId);
    if (retryCleanupJobId) await admin.from("cleanup_jobs").delete().eq("id", retryCleanupJobId);
    for (const id of userIds) {
      await admin.from("cleanup_jobs").delete().eq("user_id", id);
      await admin.from("events").delete().eq("user_id", id);
      await admin.from("photos").delete().eq("user_id", id);
      await admin.from("trials").delete().eq("user_id", id);
      await admin.from("profiles").delete().eq("user_id", id);
      await admin.auth.admin.deleteUser(id);
    }
  }
});
