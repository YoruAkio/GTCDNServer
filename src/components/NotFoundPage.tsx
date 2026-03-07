import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

// @note standalone page — no Navbar inherited
export default function NotFoundPage() {
  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <p className="text-muted-foreground/30 font-mono text-[12rem] font-bold leading-none tabular-nums">
        404
      </p>
      <h1 className="text-foreground text-2xl font-semibold tracking-tight -mt-4">
        Page not found
      </h1>
      <div className="flex gap-2">
        <Button render={<Link to="/" />}>Go home</Button>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="size-4" />
          Go back
        </Button>
      </div>
    </main>
  );
}
