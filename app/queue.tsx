"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  url: string;
  source: string;
  status: string;
  title: string | null;
  x_post_url: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  posted_at: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  processing: "이미지 준비",
  posting: "게시 중",
  posted: "완료",
  failed: "실패",
  unknown: "확인 필요",
};

export default function Queue() {
  const [url, setUrl] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/queue", { cache: "no-store" });
    if (response.status === 401) { window.location.replace("/login"); return; }
    const data = await response.json();
    if (!response.ok) {
      setMessage({ kind: "error", text: data.error });
      return;
    }
    setRows(data.rows);
  }, []);

  useEffect(() => {
    try { localStorage.removeItem("x-post-access-token"); } catch {}
    const refresh = () => { load().catch(() => setMessage({ kind: "error", text: "목록을 불러오지 못했습니다. 다시 시도해 주세요." })); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", restore);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", restore); };
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (response.status === 401) { window.location.replace("/login"); return; }
      const data = await response.json();
      if (!response.ok) {
        setMessage({ kind: "error", text: data.error });
        return;
      }
      setUrl("");
      setMessage({ kind: "ok", text: "대기열에 등록했습니다. 작업자가 5분 안에 가져갑니다." });
      await load();
    } catch (error) {
      setMessage({ kind: "error", text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      setRows([]);
      window.location.replace("/login");
    } catch {
      setMessage({ kind: "error", text: "로그아웃하지 못했습니다. 다시 시도해 주세요." });
    }
  }

  return (
    <main className="wrap">
      <div className="head">
        <h1>X 게시 대기열</h1>
        <button type="button" className="ghost" onClick={logout}>로그아웃</button>
      </div>
      <p className="lead">블라인드 또는 오늘의유머 게시물 URL 을 넣으면 대기열에 저장됩니다.</p>

      <form onSubmit={submit} className="card">
        <label>
          게시물 URL
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.teamblind.com/kr/post/…"
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "저장 중…" : "대기열에 넣기"}
        </button>
        {message && <p className={message.kind}>{message.text}</p>}
      </form>

      <section className="card">
        <div className="head">
          <h2>최근 등록 30건</h2>
          <button type="button" className="ghost" onClick={() => load().catch(() => setMessage({ kind: "error", text: "목록을 불러오지 못했습니다." }))}>
            새로고침
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="muted">표시할 행이 없습니다.</p>
        ) : (
          <ul className="rows">
            {rows.map((row) => (
              <li key={row.id}>
                <span className={`badge ${row.status}`}>{STATUS_LABEL[row.status] ?? row.status}</span>
                <div className="body">
                  <a href={row.url} target="_blank" rel="noreferrer">
                    {row.title || row.url}
                  </a>
                  <small>
                    {new Date(row.created_at).toLocaleString("ko-KR")} · 시도 {row.attempts}회
                    {row.x_post_url && (
                      <>
                        {" · "}
                        <a href={row.x_post_url} target="_blank" rel="noreferrer">
                          X 글 보기
                        </a>
                      </>
                    )}
                  </small>
                  {row.last_error && <small className="error">{row.last_error}</small>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
