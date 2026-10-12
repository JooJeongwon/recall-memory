import { endpoint, json } from "@/lib/server/http";
import { readPhoto, rpc } from "@/lib/server/photos";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return endpoint(async () => {
    const { photo } = await readPhoto(id); return json(photo);
  })(request);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return endpoint(async () => { await rpc("soft_delete_photo", { p_photo_id: uuid.parse(id) }); return json({ status: "deleted" }); })(request);
}
import { uuid } from "@/lib/validation/contracts";
