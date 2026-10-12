import { NextResponse } from "next/server";
export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/?source=qr", request.url), 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
