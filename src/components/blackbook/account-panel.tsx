"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, KeyRound, Trash2 } from "lucide-react";
import { Button, Field, Input, useToast } from "@/components/ui";
import { api, ApiClientError } from "@/lib/offline/client";
import { ConfirmSheet } from "./confirm-sheet";

const LEGAL = [
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/guidelines", label: "Community Guidelines" },
  { href: "/legal/content-policy", label: "Content Policy" },
];

export function AccountPanel({ email }: { email: string }) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirmNext, setConfirmNext] = React.useState("");
  const [pwBusy, setPwBusy] = React.useState(false);
  const [pwError, setPwError] = React.useState<{ field?: string; message: string } | null>(null);
  const [delOpen, setDelOpen] = React.useState(false);
  const [delPassword, setDelPassword] = React.useState("");
  const [delConfirm, setDelConfirm] = React.useState("");
  const [delBusy, setDelBusy] = React.useState(false);
  const [delError, setDelError] = React.useState<string | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (next !== confirmNext) return setPwError({ field: "confirm", message: "Passwords don't match" });
    setPwBusy(true);
    try {
      await api("/api/me/password", { method: "POST", json: { current, next } });
      setCurrent(""); setNext(""); setConfirmNext("");
      toast.push("Password changed. Other devices were signed out.", "success");
    } catch (err) {
      const body = err instanceof ApiClientError ? (err.body as { field?: string } | null) : null;
      setPwError({ field: body?.field, message: err instanceof Error ? err.message : "Could not change password" });
    } finally {
      setPwBusy(false);
    }
  }
  async function deleteAccount() {
    setDelBusy(true);
    setDelError(null);
    try {
      await api("/api/me/delete", { method: "POST", json: { password: delPassword, confirm: delConfirm } });
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setDelError(err instanceof Error ? err.message : "Could not delete account");
      setDelBusy(false);
    }
  }
  const pe = (f: string) => (pwError?.field === f ? pwError.message : undefined);

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4">
        <h2 className="text-lg">Your data</h2>
        <p className="text-sm text-muted">Signed in as <span className="text-fg">{email}</span>. Download everything you&apos;ve made — profile, personas, characters with their private sheets, chats, favorites, collections, encounters, stories, comics and image metadata — as one JSON file.</p>
        <a href="/api/me/export" download="chattering-export.json" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-sm font-medium text-fg hover:bg-surface-3 focus-ring">
          <Download className="h-4 w-4" /> Export my data
        </a>
      </section>

      <form onSubmit={changePassword} className="card space-y-4 p-4">
        <h2 className="text-lg">Change password</h2>
        <Field label="Current password" error={pe("current")}><Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
        <Field label="New password" hint="At least 10 characters." error={pe("next")}><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={10} required /></Field>
        <Field label="Confirm new password" error={pe("confirm")}><Input type="password" autoComplete="new-password" value={confirmNext} onChange={(e) => setConfirmNext(e.target.value)} required /></Field>
        {pwError && !pwError.field && <p className="text-xs text-danger">{pwError.message}</p>}
        <Button type="submit" loading={pwBusy} disabled={!current || next.length < 10 || !confirmNext}>
          <KeyRound className="h-4 w-4" /> Update password
        </Button>
      </form>

      <section className="card space-y-2 p-4">
        <h2 className="text-lg">Legal</h2>
        <ul className="divide-y divide-line">
          {LEGAL.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex items-center justify-between py-2.5 text-sm text-fg-2 hover:text-fg focus-ring rounded">{l.label}<ExternalLink className="h-3.5 w-3.5 text-muted" aria-hidden /></Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 border-danger/30 p-4">
        <h2 className="text-lg text-danger">Delete account</h2>
        <p className="text-sm text-muted">Permanently removes your account, characters, chats, creations and media. Published characters disappear for everyone. There is no undo.</p>
        <Button variant="danger" onClick={() => { setDelError(null); setDelOpen(true); }}>
          <Trash2 className="h-4 w-4" /> Delete my account
        </Button>
      </section>

      <ConfirmSheet
        open={delOpen}
        title="Delete your account?"
        danger
        confirmLabel="Delete forever"
        loading={delBusy}
        onClose={() => setDelOpen(false)}
        onConfirm={deleteAccount}
        body={
          <div className="space-y-3">
            <p>This cannot be undone. Confirm your password and type <span className="font-mono text-fg">DELETE</span>.</p>
            <Field label="Password"><Input type="password" autoComplete="current-password" value={delPassword} onChange={(e) => setDelPassword(e.target.value)} /></Field>
            <Field label='Type "DELETE"'><Input value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} autoCapitalize="characters" /></Field>
            {delError && <p className="text-xs text-danger">{delError}</p>}
          </div>
        }
      />
    </div>
  );
}
