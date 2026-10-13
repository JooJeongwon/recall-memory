import { z } from "zod";
import { endpoint, json } from "@/lib/server/http";
import { accountUsageReport } from "@/lib/server/account-usage";

export const runtime = "nodejs";
export const GET = endpoint(async (request) => {
  const params = new URL(request.url).searchParams;
  const days = z.coerce.number().int().min(1).max(90).parse(params.get("days") ?? 7);
  const page = z.coerce.number().int().min(1).max(10_000).parse(params.get("page") ?? 1);
  const pageSize = z.coerce.number().int().min(1).max(50).parse(params.get("page_size") ?? 20);
  return json(await accountUsageReport(days, page, pageSize));
});
