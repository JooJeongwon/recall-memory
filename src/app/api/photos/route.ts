import { endpoint, json } from "@/lib/server/http";
import { listPhotos } from "@/lib/server/photos";

export const runtime = "nodejs";
export const GET = endpoint(async (request) => {
  return json(await listPhotos(new URL(request.url)));
});
