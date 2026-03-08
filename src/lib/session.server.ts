import "@tanstack/react-start/server-only";

import { getRequestHeaders } from "@tanstack/react-start/server";

import type { Session } from "@/lib/auth";

export async function getServerSession(): Promise<Session | null> {
  const { getAuth } = await import("@/lib/auth.server");
  const auth = await getAuth();
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  return session;
}

export async function requireServerSession(): Promise<Session> {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}
