import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = process.env.APP_BASE_URL;
  if (!base) return new Response("Auth 환경 설정이 필요합니다.", { status: 503, headers: { "Cache-Control": "private, no-store" } });
  const supabase = await createClient();
  let success = false;
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code); success = !error;
  }
  const response = NextResponse.redirect(new URL(success ? "/start" : "/login?error=oauth", base));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
