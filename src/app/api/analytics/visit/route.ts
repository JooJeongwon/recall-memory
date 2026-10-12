import { ApiError, endpoint, input } from "@/lib/server/http";
import { recordVisit } from "@/lib/server/analytics";
import { allowVisit } from "@/lib/server/visit-limit";
import { visitInput } from "@/lib/analytics";

export const runtime = "nodejs";
export const POST = endpoint(async (request) => {
  const visit = await input(request, visitInput);
  if (process.env.NODE_ENV === "production" && request.headers.get("dnt") !== "1" && request.headers.get("sec-gpc") !== "1" &&
    !/bot|crawler|spider|headless|preview|facebookexternalhit/i.test(request.headers.get("user-agent") ?? "")) {
    const address = process.env.VERCEL
      ? request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for")
      : "local";
    if (!address) throw new ApiError(400, "INVALID_INPUT");
    if (!allowVisit(address)) throw new ApiError(429, "LIMIT_EXCEEDED");
    await recordVisit(visit);
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
});
