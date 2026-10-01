import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "x-post-session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

export function sameToken(given: string, expected: string) {
  return timingSafeEqual(
    createHash("sha256").update(given).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

function signingKey() {
  const password = process.env.X_POST_PASSWORD;
  const token = process.env.X_POST_ACCESS_TOKEN;
  if (!password || !token) throw new Error("로그인 설정을 확인해 주세요.");
  // 비밀번호 또는 API 토큰을 변경하면 기존 로그인도 만료된다.
  return createHmac("sha256", token).update(password).digest();
}

export function createSession(now = Date.now()) {
  const payload = `v1.${Math.floor(now / 1000) + SESSION_MAX_AGE}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${createHmac("sha256", signingKey()).update(payload).digest("hex")}`;
}

export function verifySession(value: string | undefined, now = Date.now()) {
  if (!value || !/^v1\.\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(value)) return false;
  const [version, expires, nonce, signature] = value.split(".");
  const seconds = Math.floor(now / 1000);
  if (Number(expires) <= seconds || Number(expires) > seconds + SESSION_MAX_AGE) return false;
  try {
    const expected = createHmac("sha256", signingKey()).update(`${version}.${expires}.${nonce}`).digest("hex");
    return sameToken(signature, expected);
  } catch {
    return false;
  }
}

export function isSameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

export function cookieOptions(request: Request) {
  return {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
