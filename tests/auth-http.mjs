// Read-only checks: the sole queue POST has an empty URL and must never insert a row.
import assert from "node:assert/strict";

const base = process.env.TEST_BASE_URL || "http://localhost:3100";
const password = process.env.TEST_LOGIN_PASSWORD;
assert.ok(password, "TEST_LOGIN_PASSWORD is required");
const request = (path, options = {}) => fetch(new URL(path, base), { redirect: "manual", ...options });
const post = (path, body, cookie, origin = base) => request(path, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body),
});

let response = await request("/");
assert.equal(response.status, 307);
assert.equal(new URL(response.headers.get("location"), base).pathname, "/login");
assert.ok(!(await response.text()).includes("최근 등록 30건"));
response = await request("/", { headers: { RSC: "1" } });
assert.ok(!(await response.text()).includes("최근 등록 30건"));
response = await request("/login");
const html = await response.text();
assert.equal(response.status, 200);
assert.ok(html.includes('type="password"'));
assert.ok(!html.includes("게시물 URL"));
assert.equal((await request("/api/queue")).status, 401);
assert.equal((await post("/api/queue", { url: "" })).status, 401);
assert.equal((await post("/api/auth/login", { password }, undefined, "https://evil.example")).status, 403);
assert.equal((await post("/api/auth/login", { password: "intentionally-wrong-password" })).status, 401);
response = await post("/api/auth/login", { password });
assert.equal(response.status, 200, await response.clone().text());
const setCookie = response.headers.get("set-cookie");
assert.ok(setCookie.includes("HttpOnly"));
assert.ok(/SameSite=strict/i.test(setCookie));
assert.ok(/Max-Age=604800/i.test(setCookie));
if (base.startsWith("https:")) assert.ok(setCookie.includes("Secure"));
const cookie = setCookie.split(";")[0];
response = await request("/", { headers: { Cookie: cookie } });
assert.equal(response.status, 200);
assert.ok((await response.text()).includes("최근 등록 30건"));
assert.equal((await request("/login", { headers: { Cookie: cookie } })).status, 307);
assert.equal((await post("/api/queue", { url: "" }, cookie)).status, 400);
assert.equal((await post("/api/queue", { url: "" }, cookie, "https://evil.example")).status, 401);
assert.equal((await request("/api/queue", { headers: { Cookie: "x-post-session=forged" } })).status, 401);
if (process.env.TEST_LIVE_QUEUE === "1") {
  response = await request("/api/queue", { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.ok(Array.isArray((await response.json()).rows));
}
assert.equal((await post("/api/auth/logout", {}, cookie, "https://evil.example")).status, 403);
response = await post("/api/auth/logout", {}, cookie);
assert.equal(response.status, 200);
assert.ok(response.headers.get("set-cookie").includes("Max-Age=0"));
assert.equal((await request("/")).status, 307);
assert.equal((await request("/api/queue")).status, 401);
console.log("PASS: login gate, password rejection, signed cookie, authenticated page/API, CSRF, logout; no queue rows created.");

if (process.env.TEST_RATE_LIMIT === "1") {
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await post("/api/auth/login", { password: "wrong" })).status);
  assert.ok(statuses.includes(429), `Expected rate limit: ${statuses}`);
  console.log("PASS: repeated login attempts are rate limited.");
}
