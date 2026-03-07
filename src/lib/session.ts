import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

// @note server fn to read the current session from cookies — call in loaders and beforeLoad
export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getAuth } = await import("@/lib/auth.server");
  const auth = await getAuth();
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  return session;
});
