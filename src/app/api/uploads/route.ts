import { endpoint, json, input } from "@/lib/server/http";
import { reserveUploads } from "@/lib/server/uploads";
import { uploadInput } from "@/lib/validation/contracts";

export const runtime = "nodejs";
export const POST = endpoint(async (request) => {
  return json(await reserveUploads(await input(request, uploadInput)), 201);
});
