import { NextResponse } from "next/server";
import { cookieOptions, isSameOrigin, SESSION_COOKIE } from "../../../lib/auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(request), maxAge: 0 });
  return response;
}
