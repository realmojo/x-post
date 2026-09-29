import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const COLUMNS = "id,url,source,status,title,x_post_url,attempts,last_error,created_at,posted_at";

function config() {
  const url = process.env.X_QUEUE_SUPABASE_URL;
  const key = process.env.X_QUEUE_SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.X_POST_ACCESS_TOKEN;
  if (!url || !key || !token) {
    throw new Error("X_QUEUE_SUPABASE_URL, X_QUEUE_SUPABASE_SERVICE_ROLE_KEY, X_POST_ACCESS_TOKEN 을 설정하세요.");
  }
  return { url, key, token };
}

// 길이가 달라도 비교 시간이 같도록 해시끼리 비교한다.
function sameToken(given: string, expected: string) {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function open(request: Request) {
  const { url, key, token } = config();
  const given = request.headers.get("x-access-token") ?? "";
  if (!given || !sameToken(given, token)) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request: Request) {
  try {
    const db = open(request);
    if (!db) return json({ error: "접근 암호가 맞지 않습니다." }, 401);
    const { data, error } = await db
      .from("x_post_queue")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return json({ error: `목록 조회 실패: ${error.message}` }, 500);
    return json({ rows: data });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const db = open(request);
    if (!db) return json({ error: "접근 암호가 맞지 않습니다." }, 401);

    const body = await request.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) return json({ error: "URL 을 입력하세요." }, 400);
    if (url.length > 4000) return json({ error: "URL 이 너무 깁니다." }, 400);

    // source·source_key 정규화와 지원 사이트 검사는 DB 트리거(supabase/queue.sql)가 한다.
    const { data, error } = await db.from("x_post_queue").insert({ url }).select(COLUMNS).single();
    if (error) {
      if (error.code === "23505") return json({ error: "이미 등록된 게시물입니다." }, 409);
      // 트리거가 던진 안내 문구(지원하지 않는 URL 등)를 그대로 보여 준다.
      if (error.code === "P0001") return json({ error: error.message }, 400);
      return json({ error: `저장 실패: ${error.message}` }, 500);
    }
    return json({ row: data }, 201);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
}
