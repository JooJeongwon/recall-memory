import { endpoint } from "@/lib/server/http";
import { downloadAsset } from "@/lib/server/photos";
import { z } from "zod";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return endpoint(async (request) => {
    const kind = z.enum(["original", "thumbnail"]).parse(new URL(request.url).searchParams.get("kind") ?? "thumbnail");
    const { photo, data } = await downloadAsset(id, kind);
    return new Response(data, { headers: {
      "Cache-Control": "private, no-store",
      "Content-Length": String(data.size),
      "Content-Type": kind === "original" ? photo.mime_type : "image/webp",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    } });
  })(request);
}
