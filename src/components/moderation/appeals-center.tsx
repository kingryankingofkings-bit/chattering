"use client";
import * as React from "react";
import { Button, EmptyState, ErrorState, Skeleton, Textarea, useToast } from "@/components/ui";
import { api } from "@/lib/offline/client";
import { timeAgo } from "@/lib/utils";

type Moderated = { targetType: string; targetId: string; title: string; status: string; lastAction: { action: string; note: string | null } | null; hasOpenAppeal: boolean };
type Appeal = { id: string; targetType: string; targetId: string; message: string; status: string; response: string | null; createdAt: string; target: { title: string } };

export function AppealsCenter() {
  const [data, setData] = React.useState<{ moderated: Moderated[]; appeals: Appeal[] } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const toast = useToast();
  const load = React.useCallback(async () => {
    setError(null);
    try {
      setData(await api("/api/appeals"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);
  React.useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  async function submit(m: Moderated) {
    const key = `${m.targetType}:${m.targetId}`;
    try {
      await api("/api/appeals", { method: "POST", json: { targetType: m.targetType, targetId: m.targetId, message: draft[key] ?? "" } });
      toast.push("Appeal submitted. A human will review it.", "success");
      await load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Couldn't submit", "error");
    }
  }
  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!data) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-lg">Content under moderation</h2>
        {data.moderated.length === 0 ? (
          <EmptyState title="Nothing under review" description="None of your characters or works are hidden or removed." />
        ) : (
          <div className="space-y-3">
            {data.moderated.map((m) => {
              const key = `${m.targetType}:${m.targetId}`;
              return (
                <div key={key} className="card space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{m.title}</span>
                    <span className="rounded-md bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning">{m.status}</span>
                  </div>
                  <p className="text-xs text-muted">{m.targetType.toLowerCase()}{m.lastAction ? ` · ${m.lastAction.action.toLowerCase()}${m.lastAction.note ? `: ${m.lastAction.note}` : ""}` : ""}</p>
                  {m.hasOpenAppeal ? (
                    <p className="text-xs text-success">Appeal pending review.</p>
                  ) : (
                    <>
                      <Textarea placeholder="Explain why this should be restored (10+ characters)" value={draft[key] ?? ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} className="min-h-[72px]" />
                      <Button size="sm" disabled={(draft[key] ?? "").trim().length < 10} onClick={() => submit(m)}>Submit appeal</Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-lg">Your appeals</h2>
        {data.appeals.length === 0 ? (
          <p className="text-sm text-muted">No appeals yet.</p>
        ) : (
          <div className="space-y-2">
            {data.appeals.map((a) => (
              <div key={a.id} className="card p-3 text-sm">
                <div className="flex items-center justify-between"><span className="font-medium">{a.target.title}</span><span className="text-[10px] uppercase text-muted">{a.status}</span></div>
                <p className="mt-1 text-fg-2">{a.message}</p>
                {a.response && <p className="mt-1 text-xs text-success">Moderator: {a.response}</p>}
                <p className="mt-1 text-[11px] text-muted">{timeAgo(a.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
