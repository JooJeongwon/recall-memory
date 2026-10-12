import "server-only";
import { z } from "zod";
import { requireUser } from "./auth";
import { adminClient } from "./admin";
import { ApiError, dbError } from "./http";
import { policy } from "../config";
import { photoSchema, photoColumns, uuid } from "../validation/contracts";
import type { Database } from "@/types/database";

type Functions = Database["public"]["Functions"];
// 실제 DB의 RPC 오버로드도 각 인자의 단계 필드를 유지합니다.
type UserlessArgs<Args> = Args extends unknown ? Omit<Args, "p_user_id"> : never;
// 인증 결과는 같은 서버 요청 내부에서만 재사용합니다.
export async function rpc<Name extends keyof Functions>(name: Name, args: UserlessArgs<Functions[Name]["Args"]>,
  auth?: Awaited<ReturnType<typeof requireUser>>) {
  const { user } = auth ?? await requireUser();
  const params = { ...args, p_user_id: user.id } as Functions[Name]["Args"];
  const { data: result, error } = await adminClient().rpc(name, params);
  dbError(error, `rpc.${name}`);
  const data: unknown = result;
  if (data && typeof data === "object" && "error" in data) {
    throw new ApiError(409, z.string().parse(data.error), "current" in data ? { current: photoSchema.parse(data.current) } : undefined);
  }
  return data as Functions[Name]["Returns"] | null;
}
export async function readPhoto(id: string) {
  uuid.parse(id);
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("photos").select(`${photoColumns},original_key,thumbnail_key`)
    .eq("id", id).eq("lifecycle", "ready").maybeSingle();
  dbError(error);
  if (!data) throw new ApiError(404, "NOT_FOUND");
  return { supabase, photo: photoSchema.parse(data), originalKey: String(data.original_key), thumbnailKey: String(data.thumbnail_key) };
}
export async function listPhotos(url: URL) {
  const { supabase } = await requireUser();
  const scope = z.enum(["all", "preserved"]).parse(url.searchParams.get("scope") ?? "all");
  const limit = z.coerce.number().int().min(1).max(20).parse(url.searchParams.get("limit") ?? 12);
  const field = scope === "preserved" ? "preserved_at" : "ready_at";
  const ascending = scope === "all";
  let query = supabase.from("photos").select(photoColumns).eq("lifecycle", "ready")
    .order(field, { ascending }).order("id", { ascending }).limit(limit + 1);
  if (scope === "preserved") query = query.not("preserved_at", "is", null);
  const cursor = url.searchParams.get("cursor");
  if (cursor) {
    try {
      const point = z.object({ time: z.iso.datetime({ offset: true }), id: uuid, scope: z.literal(scope) })
        .strict().parse(JSON.parse(Buffer.from(cursor, "base64url").toString()));
      const time = new Date(point.time).toISOString();
      const comparison = ascending ? "gt" : "lt";
      query = query.or(`${field}.${comparison}.${time},and(${field}.eq.${time},id.${comparison}.${point.id})`);
    } catch { throw new ApiError(400, "INVALID_INPUT"); }
  }
  const { data, error } = await query;
  dbError(error);
  const photos = z.array(photoSchema).parse(data ?? []);
  const page = photos.slice(0, limit);
  const last = page.at(-1);
  return { photos: page, next_cursor: photos.length > limit && last ? Buffer.from(JSON.stringify({
    time: last[field], id: last.id, scope,
  })).toString("base64url") : null };
}
export async function downloadAsset(id: string, kind: "original" | "thumbnail") {
  const { supabase, photo, originalKey, thumbnailKey } = await readPhoto(id);
  const { data, error } = await supabase.storage.from(policy.bucket)
    .download(kind === "original" ? originalKey : thumbnailKey, {}, { cache: "no-store" });
  if (error || !data) throw new ApiError(503, "TEMPORARY_FAILURE");
  return { photo, data };
}
