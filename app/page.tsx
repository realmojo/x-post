import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "./lib/auth";
import Queue from "./queue";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!verifySession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/login");
  return <Queue />;
}
