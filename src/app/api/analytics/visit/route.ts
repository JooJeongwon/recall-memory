import { env } from "cloudflare:workers";
import { ApiError, endpoint, input } from "@/lib/server/http";
import { recordVisit } from "@/lib/server/analytics";
import { visitInput } from "@/lib/analytics";

export const runtime = "nodejs";
export const POST = endpoint(async (request) => {
  const visit = await input(request, visitInput);
  if (process.env.NODE_ENV === "production" && request.headers.get("dnt") !== "1" && request.headers.get("sec-gpc") !== "1" &&
    !/bot|crawler|spider|headless|preview|facebookexternalhit/i.test(request.headers.get("user-agent") ?? "")) {
    const key = request.headers.get("cf-connecting-ip");
    if (!key) throw new ApiError(400, "INVALID_INPUT");
    const { success } = await env.VISIT_LIMIT.limit({ key });
    if (!success) throw new ApiError(429, "LIMIT_EXCEEDED");
    await recordVisit(visit);
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
}, "/api/analytics/visit");
