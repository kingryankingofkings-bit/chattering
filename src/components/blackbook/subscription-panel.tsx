"use client";
import * as React from "react";
import { Check, Crown, Minus } from "lucide-react";
import { Button, ErrorState, Skeleton, useToast } from "@/components/ui";
import type { MeDto } from "@/lib/blackbook";
import { api } from "@/lib/offline/client";
import { ConfirmSheet } from "./confirm-sheet";
import { useResource } from "./use-resource";

const FEATURES: { label: string; free: string | boolean; plus: string | boolean }[] = [
  { label: "Chats per day", free: "40", plus: "Unlimited" },
  { label: "Message memory window", free: "30 messages", plus: "Long-form memory" },
  { label: "Image generations", free: "6 / hour", plus: "60 / hour" },
  { label: "Stories & comics", free: "Short", plus: "Long & multi-chapter" },
  { label: "Priority generation", free: false, plus: true },
  { label: "Early access characters", free: false, plus: true },
  { label: "Supporter badge", free: false, plus: true },
];

export function SubscriptionPanel() {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useResource<{ user: MeDto }>("/api/me");
  const [confirm, setConfirm] = React.useState<"PLUS" | "FREE" | null>(null);
  const [busy, setBusy] = React.useState(false);
  if (loading) return <Skeleton className="h-80 w-full !rounded-2xl" />;
  if (error || !data) return <ErrorState description={error ?? undefined} onRetry={reload} />;
  const tier = data.user.subscriptionTier;
  const renews = data.user.subscriptionRenewsAt ? new Date(data.user.subscriptionRenewsAt).toLocaleDateString() : null;

  async function switchTier(next: "PLUS" | "FREE") {
    setBusy(true);
    try {
      // Placeholder flow: swaps the tier directly until a payment provider is connected (see the API route comment).
      const res = await api<{ user: MeDto }>("/api/me/subscription", { method: "POST", json: { tier: next } });
      setData({ user: res.user });
      setConfirm(null);
      toast.push(next === "PLUS" ? "Welcome to Plus" : "Switched to Free", "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not update subscription", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className={`card p-4 ${tier === "PLUS" ? "border-gold/40 shadow-[0_0_0_1px_rgba(217,168,92,.2),0_16px_40px_-20px_rgba(217,168,92,.5)]" : ""}`}>
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tier === "PLUS" ? "bg-gold-soft text-gold" : "bg-surface-2 text-muted"}`}><Crown className="h-5 w-5" /></span>
          <div>
            <p className="font-display text-lg leading-tight">{tier === "PLUS" ? "Chattering Plus" : "Free"}</p>
            <p className="text-xs text-muted">{tier === "PLUS" ? `Renews ${renews ?? "monthly"} · $9.99 / month` : "Everything you need to start. Upgrade any time."}</p>
          </div>
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 text-left font-medium">Feature</th>
              <th className="px-3 py-3 text-center font-medium">Free</th>
              <th className="px-3 py-3 text-center font-medium text-gold">Plus</th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => (
              <tr key={f.label} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 text-fg-2">{f.label}</td>
                <td className="px-3 py-2.5 text-center text-xs text-muted"><Cell v={f.free} /></td>
                <td className="px-3 py-2.5 text-center text-xs text-fg"><Cell v={f.plus} gold /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tier === "PLUS" ? (
        <Button variant="outline" className="w-full" onClick={() => setConfirm("FREE")}>Cancel Plus</Button>
      ) : (
        <Button variant="gold" size="lg" className="w-full" onClick={() => setConfirm("PLUS")}>
          <Crown className="h-4 w-4" /> Upgrade to Plus — $9.99/mo
        </Button>
      )}
      <p className="text-center text-[11px] text-muted">Renews monthly until cancelled. Cancel any time; access continues until the end of the paid period.</p>
      <ConfirmSheet open={confirm === "PLUS"} title="Upgrade to Plus" body={<>You&apos;ll be charged $9.99 today and every 30 days until you cancel. Plus unlocks unlimited chats, long-form memory and faster generation.</>} confirmLabel="Confirm upgrade" loading={busy} onClose={() => setConfirm(null)} onConfirm={() => switchTier("PLUS")} />
      <ConfirmSheet open={confirm === "FREE"} title="Cancel Plus?" body={<>Your account switches back to Free. You can come back whenever you like.</>} confirmLabel="Cancel Plus" danger loading={busy} onClose={() => setConfirm(null)} onConfirm={() => switchTier("FREE")} />
    </div>
  );
}

function Cell({ v, gold }: { v: string | boolean; gold?: boolean }) {
  if (v === true) return <Check className={`mx-auto h-4 w-4 ${gold ? "text-gold" : "text-success"}`} aria-label="Included" />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-muted/60" aria-label="Not included" />;
  return <>{v}</>;
}
