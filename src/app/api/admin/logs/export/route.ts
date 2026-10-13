import { z } from "zod";
import { endpoint } from "@/lib/server/http";
import { logWorkbook } from "@/lib/server/log-export";

export const runtime = "nodejs";
export const maxDuration = 60;
export const GET = endpoint(async (request) => {
  const days = z.coerce.number().int().min(1).max(90).parse(new URL(request.url).searchParams.get("days") ?? 90);
  const file = await logWorkbook(days);
  return new Response(new Uint8Array(file.bytes), {headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="recall-logs-${file.date}.xlsx"`,
    "Cache-Control": "private, no-store",
  }});
});
