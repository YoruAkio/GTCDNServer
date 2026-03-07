import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowRight, FolderLock, Globe, Shield } from "lucide-react";

import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";

const features = [
  {
    icon: FolderLock,
    title: "Private cache hosting",
    description:
      "Host your Growtopia private server cache files on your own CDN. Players download directly from your endpoint — no third-party CDN subscription required.",
  },
  {
    icon: Globe,
    title: "Edge delivery via Cloudflare",
    description: `Files are served from Cloudflare's global edge network, keeping latency low for players regardless of their region.`,
  },
  {
    icon: Shield,
    title: "Keep your cache private",
    description:
      "Your cache stays yours. No public exposure, no vendor lock-in. Built for GTPS developers who need control without a recurring bill.",
  },
];

function HomePage() {
  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 py-12 space-y-20">
        {/* hero */}
        <section className="space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            CDN for Growtopia private servers
          </h1>
          <p className="text-lg leading-8 text-muted-foreground max-w-2xl">
            GTCDN lets GTPS developers self-host their cache files on
            Cloudflare's edge — no subscription, no third-party dependency. Just
            deploy, point your server, and keep your cache private.
          </p>
          <div className="flex gap-3 pt-1">
            <Button render={<a href="/admin" />} size="default">
              Manage Files
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>

        {/* feature list */}
        <section className="space-y-1">
          {features.map(f => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="flex gap-5 py-5 border-b border-border last:border-0"
              >
                <div className="shrink-0 mt-0.5">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </div>
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {f.title}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {f.description}
                  </p>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getSession();
    if (session) {
      throw redirect({ to: "/admin" });
    }
  },
  head: () => ({
    meta: [
      { title: "GTCDN — Growtopia Private Server CDN" },
      {
        name: "description",
        content:
          "Self-hosted CDN for Growtopia private server cache files. No subscription, runs on Cloudflare Workers.",
      },
    ],
  }),
  component: HomePage,
});
