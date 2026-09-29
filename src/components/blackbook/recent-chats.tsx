"use client";
import * as React from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, MessageCircle, Trash2 } from "lucide-react";
import { Avatar, Button, EmptyState, ErrorState, Segmented, Skeleton, useToast } from "@/components/ui";
import { FeedSentinel } from "@/components/feed/feed-sentinel";
import { useInfiniteFeed } from "@/components/feed/use-infinite-feed";
import { api } from "@/lib/offline/client";
import { timeAgo } from "@/lib/utils";
import { ConfirmSheet } from "./confirm-sheet";

type ChatItem = { id: string; title: string; characterId: string; character: { id: string; name: string; avatarUrl: string | null; avatarSeed: string }; lastMessageAt: string; messageCount: number; isPreview: boolean; archived?: boolean };

export function RecentChats() {
  const toast = useToast();
  const [view, setView] = React.useState<"active" | "archived">("active");
  const feed = useInfiniteFeed<ChatItem>(`/api/chats?archived=${view === "archived"}`);
  const [confirm, setConfirm] = React.useState<ChatItem | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function archive(c: ChatItem, archived: boolean) {
    setBusy(c.id);
    try {
      await api(`/api/chats/${c.id}`, { method: "PUT", json: { archived } });
      feed.mutate((items) => items.filter((x) => x.id !== c.id));
      toast.push(archived ? "Chat archived" : "Chat restored", "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not update chat", "error");
    } finally {
      setBusy(null);
    }
  }
  async function remove() {
    if (!confirm) return;
    setBusy(confirm.id);
    try {
      await api(`/api/chats/${confirm.id}`, { method: "DELETE" });
      feed.mutate((items) => items.filter((x) => x.id !== confirm.id));
      toast.push("Chat deleted", "success");
      setConfirm(null);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not delete", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <Segmented value={view} onChange={setView} options={[{ value: "active", label: "Recent" }, { value: "archived", label: "Archived" }]} />
      {feed.error && feed.items.length === 0 ? (
        <ErrorState description={feed.error} onRetry={feed.refresh} />
      ) : feed.loading ? (
        <div className="space-y-2" aria-busy="true">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[76px] w-full !rounded-2xl" />)}</div>
      ) : feed.items.length === 0 ? (
        <EmptyState icon={<MessageCircle className="h-8 w-8" />} title={view === "archived" ? "Nothing archived" : "No chats yet"} description={view === "archived" ? "Archived chats live here, out of the way." : "Start a conversation from any character's profile."} action={view === "active" ? <Button href="/explore" variant="secondary">Find someone</Button> : undefined} />
      ) : (
        <ul className="space-y-2">
          {feed.items.map((c) => (
            <li key={c.id} className="card fade-up flex items-center gap-3 p-3">
              <Link href={`/chat/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 focus-ring rounded-xl">
                <Avatar name={c.character.name} seed={c.character.avatarSeed} src={c.character.avatarUrl} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{c.title || c.character.name}</span>
                  <span className="block truncate text-xs text-muted">{c.character.name} · {c.messageCount} message{c.messageCount === 1 ? "" : "s"} · {timeAgo(c.lastMessageAt)}{c.isPreview ? " · test" : ""}</span>
                </span>
              </Link>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={view === "archived" ? "Restore chat" : "Archive chat"} disabled={busy === c.id} onClick={() => archive(c, view !== "archived")}>
                {view === "archived" ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-danger" aria-label="Delete chat" onClick={() => setConfirm(c)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <FeedSentinel onVisible={feed.loadMore} loading={feed.loadingMore} done={feed.done} />
      <ConfirmSheet open={!!confirm} title="Delete chat?" body={<>Every message with <span className="text-fg">{confirm?.character.name}</span> in this chat will be permanently deleted.</>} confirmLabel="Delete" danger loading={!!busy} onClose={() => setConfirm(null)} onConfirm={remove} />
    </div>
  );
}
