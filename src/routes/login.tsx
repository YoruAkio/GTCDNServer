import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth";
import { ADMIN_EMAIL } from "@/lib/constants";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const session = await getSession();
    if (session) {
      throw redirect({ to: "/admin" });
    }
  },
  head: () => ({
    meta: [{ title: "Sign in — GTCDN" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await authClient.signIn.email({
      email: ADMIN_EMAIL,
      password,
    });

    if (error) {
      setError("Incorrect password.");
      setLoading(false);
      return;
    }

    await router.navigate({ to: "/admin" });
  }

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-primary/15 border-primary/30 text-primary flex size-10 items-center justify-center rounded-xl border">
            <Zap className="size-5" strokeWidth={2.5} />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-foreground text-xl font-semibold tracking-tight">
              Sign in to GTCDN
            </h1>
            <p className="text-muted-foreground text-sm">Admin access only</p>
          </div>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* read-only username */}
          <div className="space-y-2">
            <label className="text-foreground block text-sm font-medium">Username</label>
            <input
              type="text"
              readOnly
              value="admin"
              className="border-input bg-muted text-muted-foreground w-full cursor-default rounded-lg border px-3 py-2 text-sm outline-none select-none"
            />
          </div>

          {/* password */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-foreground block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
