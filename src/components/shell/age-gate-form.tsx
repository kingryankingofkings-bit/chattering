"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/lib/offline/client";

export function AgeGateForm({ alreadyVerified }: { alreadyVerified: boolean }) {
  const router = useRouter();
  const [a, setA] = React.useState(false);
  const [b, setB] = React.useState(false);
  const [c, setC] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function confirm() {
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/age-verify", { method: "POST", json: { confirm: true } });
      router.replace("/explore");
      router.refresh();
    } catch {
      setError("Could not save your confirmation. Try again.");
    } finally {
      setLoading(false);
    }
  }
  async function leave() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }
  return (
    <div className="card space-y-5 p-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-accent-2" />
        <div>
          <h1 className="text-2xl">Adults only</h1>
          <p className="text-sm text-muted">{alreadyVerified ? "Confirm again on this device to continue." : "One-time confirmation before any adult content is shown."}</p>
        </div>
      </div>
      <div className="space-y-3 text-sm text-fg-2">
        {[
          [a, setA, "I am 18 years of age or older, and viewing adult material is legal where I live."],
          [b, setB, "I understand every character on Chattering is fictional and portrayed as an adult, and that content depicting minors, real people, non-consent, incest, bestiality or anything illegal is prohibited and will be reported."],
          [c, setC, "I want to see adult content and I can turn on blur and intensity limits any time in my Blackbook."],
        ].map(([v, set, text], i) => (
          <label key={i} className="flex items-start gap-3">
            <input type="checkbox" checked={v as boolean} onChange={(e) => (set as (x: boolean) => void)(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" />
            <span>{text as string}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <div className="flex flex-col gap-2">
        <Button size="lg" disabled={!(a && b && c)} loading={loading} onClick={confirm}>Enter</Button>
        <Button variant="ghost" onClick={leave}>I&apos;m under 18 — take me out</Button>
      </div>
    </div>
  );
}
