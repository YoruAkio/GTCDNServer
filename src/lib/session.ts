import { createServerFn } from "@tanstack/react-start";

// @note server fn to read the current session from cookies — call in loaders and beforeLoad
export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getServerSession } = await import("@/lib/session.server");
  return getServerSession();
});
