import { endpoint, ApiError } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { adminClient } from "@/lib/server/admin";
import { policy, formats } from "@/lib/config";
import { zipSync, strToU8 } from "fflate";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return endpoint(async () => {
    const { user } = await requireUser();

    const { data, error } = await adminClient()
      .from("photos")
      .select("id,note_text,original_name,mime_type,ready_at,preserved_at,original_key")
      .eq("user_id", user.id).eq("lifecycle", "ready").not("preserved_at", "is", null);
    if (error) throw new ApiError(503, "TEMPORARY_FAILURE");
    if (!data?.length) throw new ApiError(404, "NOT_FOUND");

    const keys = data.map((p) => String(p.original_key));
    const { data: signed, error: urlErr } = await adminClient()
      .storage.from(policy.bucket).createSignedUrls(keys, policy.assetTtl);
    if (urlErr || !signed) throw new ApiError(503, "TEMPORARY_FAILURE");

    const files: Parameters<typeof zipSync>[0] = {};
    await Promise.all(data.map(async (photo, i) => {
      const signedUrl = signed[i]?.signedUrl;
      if (!signedUrl) return;
      try {
        const res = await fetch(signedUrl, { cache: "no-store" });
        if (!res.ok) return;
        const bytes = new Uint8Array(await res.arrayBuffer());
        const ext = formats[photo.mime_type as keyof typeof formats] ?? "jpg";
        const memory = {
          schema_version: 1, photo_id: photo.id, original_name: photo.original_name,
          note_text: photo.note_text, preserved_at: photo.preserved_at,
          exported_at: new Date().toISOString(),
        };
        files[`${photo.id}/original.${ext}`] = bytes;
        files[`${photo.id}/memory.json`] = strToU8(JSON.stringify(memory, null, 2));
      } catch { /* 개별 사진 오류 무시 */ }
    }));

    if (!Object.keys(files).length) throw new ApiError(503, "TEMPORARY_FAILURE");

    const archive = zipSync(files, { level: 0 });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(archive, { status: 200, headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="memories-${date}.zip"`,
      "Cache-Control": "private, no-store",
    }});
  })(request);
}
