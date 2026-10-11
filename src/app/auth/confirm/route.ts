import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = process.env.APP_BASE_URL?.replace(/^﻿/, "").trim();
  if (!base) return new Response("Auth 환경 설정이 필요합니다.", { status: 503, headers: { "Cache-Control": "private, no-store" } });
  const token_hash = url.searchParams.get("token_hash");
  const supabase = await createClient();
  let success = false;
  if (token_hash && url.searchParams.get("type") === "email") {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: "email" }); success = !error;
  } else if (url.searchParams.get("code")) {
    const { error } = await supabase.auth.exchangeCodeForSession(url.searchParams.get("code")!); success = !error;
  }
  // next/redirect 값은 받지 않고 구성된 주소로만 이동합니다.
  const response = NextResponse.redirect(new URL(success ? "/start" : "/login?error=expired", base));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
