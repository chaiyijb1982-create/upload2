import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import AICFOClient from "./AICFOClient";

const AUTH_COOKIE = "ai_cfo_auth";

export default async function AICFOPage() {
  const cookieStore = await cookies();

  const authCookie = cookieStore.get(AUTH_COOKIE)?.value;

  if (authCookie !== "authenticated") {
    redirect("/ai-cfo/login");
  }

  return <AICFOClient />;
}