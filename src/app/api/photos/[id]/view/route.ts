import { endpoint } from "@/lib/server/http";
import { rpc } from "@/lib/server/photos";
import { uuid } from "@/lib/validation/contracts";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return endpoint(async () => {
    await rpc("mark_viewed", { p_photo_id: uuid.parse(id) });
return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  })(request);
}


\n