import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { cookieOptions, createSession, isSameOrigin, sameToken, SESSION_COOKIE } from "../../../lib/auth";

export async function POST(request: Request) {
  const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!isSameOrigin(request)) return json("허용되지 않은 요청입니다.", 403);
  try {
    const { env } = await getCloudflareContext({ async: true });
    const limiter = (env as unknown as { LOGIN_RATE_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> } }).LOGIN_RATE_LIMITER;
    const { success } = await limiter.limit({ key: `x-post-login:${request.headers.get("cf-connecting-ip") || "local"}` });
    if (!success) {
      const response = json("로그인 시도가 너무 많습니다. 1분 후 다시 시도해 주세요.", 429);
      response.headers.set("Retry-After", "60");
      return response;
    }
    const expected = process.env.X_POST_PASSWORD;
    if (!expected) return json("로그인 설정을 확인해 주세요.", 503);
    const body = await request.json().catch(() => null);
    if (typeof body?.password !== "string" || body.password.length > 256 || !sameToken(body.password, expected)) {
      return json("비밀번호가 맞지 않습니다.", 401);
    }
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, createSession(), cookieOptions(request));
    return response;
  } catch {
    return json("로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.", 503);
  }
}
