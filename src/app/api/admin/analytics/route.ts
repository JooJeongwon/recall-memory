import { z } from "zod";
import { endpoint, json } from "@/lib/server/http";
import { analyticsReport } from "@/lib/server/analytics";

export const runtime = "nodejs";
export const GET = endpoint(async (request) => {
  const days = z.coerce.number().int().min(1).max(90).parse(new URL(request.url).searchParams.get("days") ?? 7);
  return json(await analyticsReport(days));
}, "/api/admin/analytics");
