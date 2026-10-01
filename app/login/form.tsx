"use client";

import { FormEvent, useEffect, useState } from "react";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { localStorage.removeItem("x-post-access-token"); } catch {}
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "로그인하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      window.location.replace("/");
    } catch {
      setError("연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={login} className="card">
      <label htmlFor="password">비밀번호</label>
      <input id="password" name="password" type="password" autoComplete="current-password"
        autoFocus required maxLength={256} value={password}
        onChange={(event) => setPassword(event.target.value)} aria-describedby={error ? "login-error" : undefined} />
      <button type="submit" disabled={busy}>{busy ? "확인 중…" : "로그인"}</button>
      {error && <p id="login-error" className="error" role="alert">{error}</p>}
    </form>
  );
}
