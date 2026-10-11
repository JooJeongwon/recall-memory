import { endpoint, input } from "@/lib/server/http";
import { rpc } from "@/lib/server/photos";
import { eventInput } from "@/lib/validation/contracts";

export const runtime = "nodejs";
export const POST = endpoint(async (request) => {
  const event = await input(request, eventInput);
await rpc("record_event", { p_photo_id: event.photo_id, p_name: event.name, p_client_event_id: event.client_event_id, p_context: event.visit_context });
return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
});