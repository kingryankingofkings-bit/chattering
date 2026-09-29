"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, LogOut, Pin, PinOff, Settings2 } from "lucide-react";
import { Avatar, Button, Sheet, useToast } from "@/components/ui";
import type { CharacterCard } from "@/lib/characters";
import { api } from "@/lib/offline/client";
import { MAX_PINNED } from "@/lib/constants";

/** Pinned characters row for the hub, with a manage sheet (reorder + unpin). */
export function PinnedRow({ initial }: { initial: CharacterCard[] }) {
  const toast = useToast();
  const [items, setItems] = React.useState(initial);
  const [manage, setManage] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const pressTimer = React.useRef<number | null>(null);

  async function persistOrder(next: CharacterCard[]) {
    setItems(next);
    setSaving(true);
    try {
      const res = await api<{ items: CharacterCard[] }>("/api/me/pinned", { method: "PUT", json: { order: next.map((c) => c.id) } });
      setItems(res.items);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not reorder", "error");
    } finally {
      setSaving(false);
    }
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    void persistOrder(next);
  }
  async function unpin(id: string) {
    const prev = items;
    setItems(items.filter((c) => c.id !== id));
    try {
      await api(`/api/me/pinned/${id}`, { method: "DELETE" });
    } catch (err) {
      setItems(prev);
      toast.push(err instanceof Error ? err.message : "Could not unpin", "error");
    }
  }
  const startPress = () => { pressTimer.current = window.setTimeout(() => setManage(true), 550); };
  const endPress = () => { if (pressTimer.current) window.clearTimeout(pressTimer.current); pressTimer.current = null; };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-lg"><Pin className="h-4 w-4 text-gold" aria-hidden /> Pinned</h2>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setManage(true)}>
            <Settings2 className="h-3.5 w-3.5" /> Manage
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="card flex items-center gap-3 p-4 text-sm text-muted">
          <PinOff className="h-5 w-5 shrink-0 text-accent-2/70" aria-hidden />
          <span>Pin up to {MAX_PINNED} favorites for one-tap access. Use <Link href="/blackbook/favorites" className="text-accent-2 underline-offset-2 hover:underline">Favorites › Pin</Link>.</span>
        </div>
      ) : (
        <ul className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {items.map((c) => (
            <li key={c.id} className="shrink-0">
              <Link href={`/character/${c.id}`} className="group flex w-20 flex-col items-center gap-1.5 focus-ring rounded-2xl" onPointerDown={startPress} onPointerUp={endPress} onPointerLeave={endPress} onPointerCancel={endPress} onContextMenu={(e) => { e.preventDefault(); setManage(true); }}>
                <Avatar name={c.name} seed={c.avatarSeed} src={c.avatarUrl} size={76} className="ring-2 ring-transparent transition group-hover:ring-accent/60" />
                <span className="w-full truncate text-center text-xs text-fg-2 group-hover:text-fg">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={manage} onClose={() => setManage(false)} title="Manage pinned">
        {items.length === 0 ? (
          <p className="text-sm text-muted">Nothing pinned.</p>
        ) : (
          <ul className="space-y-2" aria-busy={saving}>
            {items.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-2">
                <Avatar name={c.name} seed={c.avatarSeed} src={c.avatarUrl} size={40} rounded="rounded-xl" />
                <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move ${c.name} up`} disabled={i === 0 || saving} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move ${c.name} down`} disabled={i === items.length - 1 || saving} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" aria-label={`Unpin ${c.name}`} onClick={() => unpin(c.id)}><PinOff className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </section>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = React.useState(false);
  async function signOut() {
    setLoading(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not sign out", "error");
      setLoading(false);
    }
  }
  return (
    <Button variant="outline" className="w-full" loading={loading} onClick={signOut}>
      <LogOut className="h-4 w-4" /> Sign out
    </Button>
  );
}
