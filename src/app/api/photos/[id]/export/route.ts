import { endpoint, json } from "@/lib/server/http";
import { readPhoto } from "@/lib/server/photos";
import { formats } from "@/lib/config";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return endpoint(async () => {
    const { photo } = await readPhoto(id);
    return json({ original_filename: `original.${formats[photo.mime_type]}`, memory: {
      schema_version: 1, photo_id: photo.id, original_name: photo.original_name, note_text: photo.note_text,
      uploaded_at: photo.ready_at, preserved_at: photo.preserved_at, exported_at: new Date().toISOString(),
    } });
  })(request);
}
