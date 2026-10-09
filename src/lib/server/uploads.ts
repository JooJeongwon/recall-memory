import "server-only";
import { z } from "zod";
import { adminClient } from "./admin";
import { requireUser } from "./auth";
import { ApiError, dbError } from "./http";
import { rpc } from "./photos";
import { validateImage } from "./images";
import { policy } from "../config";
import { photoSchema, uploadInput } from "../validation/contracts";

const reservation = z.object({ id: z.uuid(), original_key: z.string(), mime_type: z.string(),
  byte_size: z.number(), lifecycle: z.string(), client_request_id: z.uuid() });

export async function reserveUploads(input: z.infer<typeof uploadInput>) {
  const photos = z.array(reservation).parse(await rpc("reserve_uploads", { p_files: input.files }));
  const admin = adminClient();
  const reservations = [];
  for (const photo of photos) {
    if (photo.lifecycle === "ready") { reservations.push({ id: photo.id, client_request_id: photo.client_request_id, already_ready: true }); continue; }
    const { data, error } = await admin.storage.from(policy.bucket).createSignedUploadUrl(photo.original_key, { upsert: false });
    if (error || !data) throw new ApiError(503, "TEMPORARY_FAILURE");
    reservations.push({ id: photo.id, client_request_id: photo.client_request_id, path: photo.original_key, token: data.token, already_ready: false });
  }
  return { reservations };
}
export async function completeUpload(id: string) {
  z.uuid().parse(id);
  const { user } = await requireUser();
  const admin = adminClient();
  const claim = z.discriminatedUnion("already_ready", [
    z.object({ already_ready: z.literal(true), photo: photoSchema }),
    z.object({ already_ready: z.literal(false), token: z.uuid(), photo: reservation.extend({ thumbnail_key: z.string() }) }),
  ]).parse(await rpc("claim_upload", { p_photo_id: id }));
  if (claim.already_ready) return { photo: photoSchema.parse(claim.photo), me: await rpc("me_state", {}) };
  const photo = reservation.parse(claim.photo);
  const downloaded = await admin.storage.from(policy.bucket).download(photo.original_key);
  if (downloaded.error || !downloaded.data) {
    // 파일 미도착/통신 오류는 같은 예약으로 재시도할 수 있게 lease를 반환합니다.
    await admin.rpc("release_upload", { p_user_id: user.id, p_photo_id: id, p_token: claim.token });
    throw new ApiError(503, "TEMPORARY_FAILURE");
  }
  try {
    if (downloaded.data.size !== photo.byte_size) throw new ApiError(415, "UNSUPPORTED_MEDIA");
    const bytes = Buffer.from(await downloaded.data.arrayBuffer());
    const image = await validateImage(bytes, photo.mime_type);
    const saved = await admin.storage.from(policy.bucket).upload(claim.photo.thumbnail_key, image.thumbnail,
      { contentType: "image/webp", upsert: true, cacheControl: "0" });
    if (saved.error) throw new ApiError(503, "TEMPORARY_FAILURE");
    const data = await rpc("complete_upload", { p_photo_id: id, p_token: claim.token,
      p_width: image.width, p_height: image.height, p_bytes: bytes.length, p_mime: image.mime });
    return { photo: photoSchema.parse(data), me: await rpc("me_state", {}) };
  } catch (error) {
    if (error instanceof ApiError && [413, 415].includes(error.status)) {
      const queued = await admin.rpc("queue_photo_delete", { p_user_id: user.id, p_photo_id: id, p_kind: "incomplete_upload" });
      dbError(queued.error);
    } else {
      await admin.rpc("release_upload", { p_user_id: user.id, p_photo_id: id, p_token: claim.token });
    }
    throw error;
  }
}
