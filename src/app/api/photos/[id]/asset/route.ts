import { endpoint, json } from "@/lib/server/http";
import { asset } from "@/lib/server/photos";
import { z } from "zod";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return endpoint(async (request) => {
    const kind = z.enum(["original", "thumbnail"]).parse(new URL(request.url).searchParams.get("kind") ?? "thumbnail");
const { url, expires_at } = await asset(id, kind); return json({ url, expires_at });
  })(request);
}


\n