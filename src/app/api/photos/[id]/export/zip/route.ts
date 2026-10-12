import { endpoint } from "@/lib/server/http";
import { ApiError } from "@/lib/server/http";
import { asset } from "@/lib/server/photos";
import { formats } from "@/lib/config";
import { zipSync, strToU8 } from "fflate";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return endpoint(async () => {
    const { photo, url } = await asset(id, "original");
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new ApiError(503, "TEMPORARY_FAILURE");
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ext = formats[photo.mime_type] ?? "jpg";
    const memory = {
      schema_version: 1, photo_id: photo.id, original_name: photo.original_name,
      note_text: photo.note_text, first_note_at: photo.first_note_at, second_note_text: photo.second_note_text, second_note_at: photo.second_note_at, uploaded_at: photo.ready_at,
      preserved_at: photo.preserved_at, exported_at: new Date().toISOString(),
    };
    const archive = zipSync({
      [`original.${ext}`]: bytes,
      "memory.json": strToU8(JSON.stringify(memory, null, 2)),
    }, { level: 0 });
    return new Response(archive, { status: 200, headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="memory-${photo.id}.zip"`,
      "Cache-Control": "private, no-store",
    }});
  })(request);
}
