import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "../lib/auth";
import LoginForm from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (verifySession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/");
  return (
    <main className="wrap login-wrap">
      <h1>X 게시 대기열</h1>
      <p className="lead">비밀번호를 입력하면 대기열을 확인할 수 있습니다.</p>
      <LoginForm />
    </main>
  );
}
