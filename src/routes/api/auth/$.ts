import { createFileRoute } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";

const getRequestAuth = createServerOnlyFn(async () => {
  const { getAuth } = await import("@/lib/auth.server");
  return getAuth();
});

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      async GET({ request }: { request: Request }) {
        const auth = await getRequestAuth();
        return auth.handler(request);
      },
      async POST({ request }: { request: Request }) {
        const auth = await getRequestAuth();
        return auth.handler(request);
      },
    },
  },
} as any);
