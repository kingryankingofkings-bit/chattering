"use client";
import * as React from "react";
import Link from "next/link";
import { Button, EmptyState, ErrorState, Segmented, Skeleton, Textarea, useToast } from "@/components/ui";
import { FeedSentinel } from "@/components/feed/feed-sentinel";
import { useInfiniteFeed } from "@/components/feed/use-infinite-feed";
import { api } from "@/lib/offline/client";
import { timeAgo } from "@/lib/utils";

type Target = { title: string; subtitle: string; ownerId: string | null; ownerName: string | null; status: string | null; href: string | null };
type Report = { id: string; targetType: string; targetId: string; reason: string; details: string; status: string; resolution: string | null; createdAt: string; reporter: { id: string; displayName: string }; target: Target; similar: number };
type Appeal = { id: string; targetType: string; targetId: string; message: string; status: string; response: string | null; createdAt: string; user: { id: string; displayName: string }; action: { action: string; note: string | null } | null; target: Target };

export function ModerationQueue() {
  const [tab, setTab] = React.useState<"reports" | "appeals">("reports");
  const [status, setStatus] = React.useState("OPEN");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={tab} onChange={(v) => { setTab(v); setStatus("OPEN"); }} options={[{ value: "reports", label: "Reports" }, { value: "appeals", label: "Appeals" }]} />
        <Segmented value={status} onChange={setStatus} options={tab === "reports" ? [{ value: "OPEN", label: "Open" }, { value: "RESOLVED", label: "Resolved" }, { value: "DISMISSED", label: "Dismissed" }, { value: "ALL", label: "All" }] : [{ value: "OPEN", label: "Open" }, { value: "ACCEPTED", label: "Accepted" }, { value: "REJECTED", label: "Rejected" }]} />
      </div>
      {tab === "reports" ? <Reports key={status} status={status} /> : <Appeals key={status} status={status} />}
    </div>
  );
}

function StatusPill({ s }: { s: string | null }) {
  const cls = s === "ACTIVE" ? "text-success bg-success/10" : s === "HIDDEN" ? "text-warning bg-warning/10" : s === "REMOVED" ? "text-danger bg-danger/10" : "text-muted bg-surface-2";
  return <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>{s ?? "gone"}</span>;
}

function TargetLine({ t, type }: { t: Target; type: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] uppercase text-muted">{type.replace("_", " ")}</span>
        {t.href ? <Link href={t.href} className="truncate font-medium underline-offset-2 hover:underline">{t.title}</Link> : <span className="truncate font-medium">{t.title}</span>}
        <StatusPill s={t.status} />
      </div>
      <p className="line-clamp-2 text-xs text-muted">{t.subtitle}</p>
      {t.ownerName && <p className="text-[11px] text-muted">by {t.ownerName}</p>}
    </div>
  );
}

function Reports({ status }: { status: string }) {
  const feed = useInfiniteFeed<Report>(`/api/moderation/reports?status=${status}`);
  const toast = useToast();
  const [note, setNote] = React.useState<Record<string, string>>({});
  async function act(r: Report, action: string) {
    try {
      await api(`/api/moderation/reports/${r.id}`, { method: "POST", json: { action, note: note[r.id] } });
      feed.mutate((items) => items.filter((x) => x.id !== r.id));
      toast.push(`${action.toLowerCase()} applied`, "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    }
  }
  if (feed.loading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>;
  if (feed.error) return <ErrorState description={feed.error} onRetry={feed.refresh} />;
  if (feed.items.length === 0) return <EmptyState title="Queue is clear" description="No reports with this status." />;
  return (
    <div className="space-y-3">
      {feed.items.map((r) => (
        <div key={r.id} className="card space-y-3 p-4">
          <TargetLine t={r.target} type={r.targetType} />
          <div className="rounded-lg bg-surface-2 p-3 text-sm">
            <p><span className="text-accent-2">{r.reason}</span>{r.similar > 1 && <span className="ml-2 text-xs text-muted">· {r.similar} reports on this target</span>}</p>
            {r.details && <p className="mt-1 text-fg-2">{r.details}</p>}
            <p className="mt-1 text-[11px] text-muted">Reported by {r.reporter.displayName} · {timeAgo(r.createdAt)}{r.resolution && ` · resolution: ${r.resolution}`}</p>
          </div>
          {r.status === "OPEN" || r.status === "REVIEWING" ? (
            <>
              <Textarea placeholder="Moderator note (optional)" value={note[r.id] ?? ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} className="min-h-[56px]" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => act(r, "HIDE")}>Hide</Button>
                <Button size="sm" variant="danger" onClick={() => act(r, "REMOVE")}>Remove</Button>
                <Button size="sm" variant="outline" onClick={() => act(r, "WARN")}>Warn</Button>
                <Button size="sm" variant="outline" onClick={() => act(r, "RESTORE")}>Restore</Button>
                <Button size="sm" variant="ghost" onClick={() => act(r, "DISMISS")}>Dismiss</Button>
              </div>
            </>
          ) : null}
        </div>
      ))}
      <FeedSentinel onVisible={feed.loadMore} loading={feed.loadingMore} done={feed.done} />
    </div>
  );
}

function Appeals({ status }: { status: string }) {
  const feed = useInfiniteFeed<Appeal>(`/api/moderation/appeals?status=${status}`);
  const toast = useToast();
  const [resp, setResp] = React.useState<Record<string, string>>({});
  async function decide(a: Appeal, decision: "ACCEPTED" | "REJECTED") {
    try {
      await api(`/api/moderation/appeals/${a.id}`, { method: "POST", json: { decision, response: resp[a.id] } });
      feed.mutate((items) => items.filter((x) => x.id !== a.id));
      toast.push(`Appeal ${decision.toLowerCase()}`, "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "error");
    }
  }
  if (feed.loading) return <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>;
  if (feed.error) return <ErrorState description={feed.error} onRetry={feed.refresh} />;
  if (feed.items.length === 0) return <EmptyState title="No appeals" description="Nothing waiting for review." />;
  return (
    <div className="space-y-3">
      {feed.items.map((a) => (
        <div key={a.id} className="card space-y-3 p-4">
          <TargetLine t={a.target} type={a.targetType} />
          <div className="rounded-lg bg-surface-2 p-3 text-sm">
            {a.action && <p className="text-xs text-muted">Action under appeal: <span className="text-fg-2">{a.action.action}</span>{a.action.note && ` — ${a.action.note}`}</p>}
            <p className="mt-1 text-fg-2">{a.message}</p>
            <p className="mt-1 text-[11px] text-muted">From {a.user.displayName} · {timeAgo(a.createdAt)}{a.response && ` · response: ${a.response}`}</p>
          </div>
          {a.status === "OPEN" && (
            <>
              <Textarea placeholder="Response to the creator (optional)" value={resp[a.id] ?? ""} onChange={(e) => setResp({ ...resp, [a.id]: e.target.value })} className="min-h-[56px]" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => decide(a, "ACCEPTED")}>Accept & restore</Button>
                <Button size="sm" variant="secondary" onClick={() => decide(a, "REJECTED")}>Reject</Button>
              </div>
            </>
          )}
        </div>
      ))}
      <FeedSentinel onVisible={feed.loadMore} loading={feed.loadingMore} done={feed.done} />
    </div>
  );
}
