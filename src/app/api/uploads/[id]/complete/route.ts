import { endpoint, json } from "@/lib/server/http";
import { completeUpload } from "@/lib/server/uploads";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return endpoint(async () => {
    return json(await completeUpload(id));
  }, "/api/uploads/[id]/complete")(request);
}
