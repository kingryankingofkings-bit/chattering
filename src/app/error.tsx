"use client";
import { Button } from "@/components/ui";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl">Something slipped.</h1>
      <p className="max-w-sm text-sm text-muted">{error.message || "An unexpected error occurred."}</p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" href="/explore">Go home</Button>
      </div>
    </div>
  );
}
