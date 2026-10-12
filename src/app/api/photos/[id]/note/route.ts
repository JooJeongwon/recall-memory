import { endpoint, json, input } from "@/lib/server/http";
import { rpc } from "@/lib/server/photos";
import { noteInput, photoSchema, uuid } from "@/lib/validation/contracts";

export const runtime = "nodejs";
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return endpoint(async (request) => {
    const note = await input(request, noteInput);
return json(photoSchema.parse(await rpc("save_note", { p_photo_id: uuid.parse(id), p_note_text: note.note_text, p_expected_version: note.expected_version, p_request_id: note.request_id, p_note_stage: note.note_stage })));
  })(request);
}
