import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Draft / Published / Under review / Removed pill for owners. */
export function StatusPill({ status, visibility, modStatus, className }: { status: string; visibility: string; modStatus: string; className?: string }) {
  if (modStatus === "REMOVED") return <span className={cn("inline-flex h-6 items-center gap-1 rounded-md border border-danger/40 bg-danger/15 px-2 text-[11px] font-semibold uppercase tracking-wide text-danger", className)}><ShieldAlert className="h-3 w-3" /> Removed</span>;
  if (modStatus === "HIDDEN") return <span className={cn("inline-flex h-6 items-center gap-1 rounded-md border border-warning/40 bg-warning/15 px-2 text-[11px] font-semibold uppercase tracking-wide text-warning", className)}><ShieldAlert className="h-3 w-3" /> Under review</span>;
  if (status === "PUBLISHED" && visibility === "PUBLIC") return <span className={cn("inline-flex h-6 items-center gap-1 rounded-md border border-success/40 bg-success/15 px-2 text-[11px] font-semibold uppercase tracking-wide text-success", className)}><Eye className="h-3 w-3" /> Public</span>;
  return <span className={cn("inline-flex h-6 items-center gap-1 rounded-md border border-line-2 bg-surface-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted", className)}><EyeOff className="h-3 w-3" /> Private draft</span>;
}

/** Full-page state for content hidden by moderation (shown to non-owners). */
export function UnderReview({ backHref, label }: { backHref: string; label: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <ShieldAlert className="h-8 w-8 text-warning" aria-hidden />
      <h1 className="text-2xl">This {label} is under review.</h1>
      <p className="max-w-sm text-sm text-muted">A moderator is taking a look. It will be back if it passes our guidelines, or removed if it doesn&apos;t.</p>
      <Button variant="secondary" href={backHref}>Back to {label === "image" ? "the gallery" : `${label}s`}</Button>
    </div>
  );
}

export function ReviewNotice({ modStatus }: { modStatus: string }) {
  if (modStatus === "ACTIVE") return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{modStatus === "REMOVED" ? "A moderator removed this for breaking the guidelines. Only you can still see it, and it can't be published." : "This is under review after reports. Only you can see it right now; it can't be published until a moderator clears it."}</span>
    </div>
  );
}
