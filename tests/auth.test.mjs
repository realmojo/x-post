import assert from "node:assert/strict";
import { test } from "node:test";
import { cookieOptions, createSession, isSameOrigin, sameToken, SESSION_MAX_AGE, verifySession } from "../app/lib/auth.ts";

test("sessions reject tampering, expiry, missing configuration and password changes", () => {
  process.env.X_POST_PASSWORD = "test-only-password";
  process.env.X_POST_ACCESS_TOKEN = "test-only-api-token";
  const now = Date.now();
  const session = createSession(now);
  assert.equal(verifySession(session, now), true);
  assert.notEqual(createSession(now), session);
  assert.equal(verifySession(undefined, now), false);
  assert.equal(verifySession("anything", now), false);
  assert.equal(verifySession(session.slice(0, -1) + (session.endsWith("0") ? "1" : "0"), now), false);
  assert.equal(verifySession(session.replace(/v1\.\d+/, "v1.9999999999"), now), false);
  assert.equal(verifySession(session, now + SESSION_MAX_AGE * 1000), false);
  process.env.X_POST_PASSWORD = "changed-password";
  assert.equal(verifySession(session, now), false);
  process.env.X_POST_PASSWORD = "test-only-password";
  delete process.env.X_POST_ACCESS_TOKEN;
  assert.equal(verifySession(session, now), false);
  assert.throws(() => createSession(now));
});

test("password comparison and cookie security", () => {
  assert.equal(sameToken("test", "test"), true);
  assert.equal(sameToken("test", "other-length"), false);
  const request = new Request("https://example.com/api/auth/login", { headers: { origin: "https://example.com" } });
  assert.equal(isSameOrigin(request), true);
  assert.equal(isSameOrigin(new Request(request.url)), false);
  assert.equal(isSameOrigin(new Request(request.url, { headers: { origin: "https://evil.example" } })), false);
  assert.deepEqual(cookieOptions(request), { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: SESSION_MAX_AGE });
});
