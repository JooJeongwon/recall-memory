import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedAppOrigin, requestOrigin } from "@/lib/server/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = process.env.APP_BASE_URL;
  if (!base) return new Response("Auth 환경 설정이 필요합니다.", { status: 503, headers: { "Cache-Control": "private, no-store" } });
  const origin = requestOrigin(request);
  const allowed = isAllowedAppOrigin(origin);
  let success = false;
  const code = url.searchParams.get("code");
  if (allowed && code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code); success = !error;
  }
  const response = NextResponse.redirect(new URL(success ? "/start" : "/login?error=oauth", allowed ? origin : base));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
