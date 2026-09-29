"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Download, MoreHorizontal, Pencil, RefreshCw, Send, ShieldAlert, Square, Trash2, Hand, Info } from "lucide-react";
import { Avatar, Button, Field, Input, IntensityBadge, Select, Sheet, Textarea, useToast } from "@/components/ui";
import { ReportButton } from "@/components/character/report-button";
import { RichText } from "./rich-text";
import type { ChatDto, MessageDto } from "@/lib/chat";
import { api, ApiClientError, OfflineError } from "@/lib/offline/client";
import { idb, type OutboxItem } from "@/lib/offline/idb";
import { useOffline } from "@/components/shell/offline-provider";
import { cn, timeAgo, uid } from "@/lib/utils";

type Persona = { id: string; name: string; isDefault: boolean };
type Props = { chat: ChatDto; messages: MessageDto[]; personas: Persona[]; boundaries: string; hardLimits: string };

export function ChatScreen(initial: Props) {
  const router = useRouter();
  const toast = useToast();
  const { online, refreshOutbox } = useOffline();
  const [chat, setChat] = React.useState(initial.chat);
  const [messages, setMessages] = React.useState<MessageDto[]>(initial.messages);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [blocked, setBlocked] = React.useState<string | null>(null);
  const [menu, setMenu] = React.useState(false);
  const [boundaries, setBoundaries] = React.useState(false);
  const [editing, setEditing] = React.useState<MessageDto | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  // Persist to IndexedDB for offline reading.
  React.useEffect(() => {
    void idb.put("chats", { id: chat.id, chat, savedAt: Date.now() });
    void idb.put("messages", { id: `chat:${chat.id}`, chatId: chat.id, items: messages });
  }, [chat, messages]);

  // Merge pending outbox items for this chat on mount / after flush.
  const loadOutbox = React.useCallback(async () => {
    const items = await idb.byIndex<OutboxItem>("outbox", "chatId", chat.id);
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.clientId).filter(Boolean));
      const pending = items.filter((i) => !known.has(i.id)).map<MessageDto>((i) => ({ id: `pending-${i.id}`, role: "user", content: i.content, createdAt: new Date(i.createdAt).toISOString(), clientId: i.id, pending: true }));
      return [...prev.filter((m) => !m.pending), ...pending];
    });
  }, [chat.id]);

  const refetch = React.useCallback(async () => {
    try {
      const data = await api<{ chat: ChatDto; messages: MessageDto[] }>(`/api/chats/${chat.id}`);
      setChat(data.chat);
      setMessages(data.messages);
    } catch {
      /* stay with local state */
    }
  }, [chat.id]);

  React.useEffect(() => {
    void Promise.resolve().then(loadOutbox);
    const onFlush = () => void refetch().then(loadOutbox);
    window.addEventListener("ctr:outbox-flushed", onFlush);
    return () => window.removeEventListener("ctr:outbox-flushed", onFlush);
  }, [loadOutbox, refetch]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, streaming]);

  function autosize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(160, el.scrollHeight) + "px";
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setBlocked(null);
    const clientId = uid("m");
    if (!online) {
      await idb.put("outbox", { id: clientId, chatId: chat.id, content, createdAt: Date.now(), attempts: 0 } satisfies OutboxItem);
      setMessages((m) => [...m, { id: `pending-${clientId}`, role: "user", content, createdAt: new Date().toISOString(), clientId, pending: true }]);
      setInput("");
      await refreshOutbox();
      toast.push("Queued. It will send when you're back online.");
      return;
    }
    setBusy(true);
    setInput("");
    requestAnimationFrame(autosize);
    const optimistic: MessageDto = { id: `tmp-${clientId}`, role: "user", content, createdAt: new Date().toISOString(), clientId };
    setMessages((m) => [...m, optimistic]);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`/api/chats/${chat.id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, clientId, stream: true }), signal: ac.signal });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setInput(content);
        if (res.status === 422) setBlocked(data.error ?? "That message isn't allowed.");
        else if (res.status === 429) toast.push("You're sending too fast. Give it a moment.", "error");
        else toast.push(data.error ?? "Couldn't send", "error");
        return;
      }
      setStreaming("");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "user") setMessages((m) => m.map((x) => (x.id === optimistic.id ? ev.message : x)));
          else if (ev.type === "delta") {
            acc += ev.text;
            setStreaming(acc);
          } else if (ev.type === "done") {
            setMessages((m) => [...m, ev.message]);
            setStreaming(null);
          } else if (ev.type === "error") {
            toast.push(ev.error, "error");
            setStreaming(null);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStreaming(null);
        void refetch();
      } else {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setInput(content);
        toast.push("Connection lost. Message not sent.", "error");
      }
    } finally {
      setStreaming(null);
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function regenerate(m: MessageDto) {
    if (busy) return;
    setBusy(true);
    try {
      const { message } = await api<{ message: MessageDto }>(`/api/chats/${chat.id}/messages/${m.id}/regenerate`, { method: "POST" });
      setMessages((ms) => ms.map((x) => (x.id === m.id ? message : x)));
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Couldn't regenerate", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: MessageDto) {
    if (m.pending && m.clientId) {
      await idb.del("outbox", m.clientId);
      await refreshOutbox();
      setMessages((ms) => ms.filter((x) => x.id !== m.id));
      return;
    }
    try {
      await api(`/api/chats/${chat.id}/messages/${m.id}`, { method: "DELETE" });
      setMessages((ms) => ms.filter((x) => x.id !== m.id));
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Couldn't delete", "error");
    }
  }

  async function saveEdit() {
    if (!editing) return;
    try {
      const { message } = await api<{ message: MessageDto }>(`/api/chats/${chat.id}/messages/${editing.id}`, { method: "PUT", json: { content: editing.content } });
      setMessages((ms) => ms.map((x) => (x.id === message.id ? message : x)));
      setEditing(null);
    } catch (err) {
      toast.push(err instanceof ApiClientError ? err.message : "Couldn't save", "error");
    }
  }

  async function updateChat(patch: Record<string, unknown>) {
    try {
      const { chat: c } = await api<{ chat: ChatDto }>(`/api/chats/${chat.id}`, { method: "PUT", json: patch });
      setChat(c);
      if (patch.clear) setMessages([]);
      toast.push("Saved", "success");
    } catch (err) {
      toast.push(err instanceof OfflineError ? "You're offline" : err instanceof Error ? err.message : "Couldn't save", "error");
    }
  }

  async function deleteChat() {
    if (!confirm("Delete this chat permanently?")) return;
    try {
      await api(`/api/chats/${chat.id}`, { method: "DELETE" });
      await idb.del("chats", chat.id);
      await idb.del("messages", `chat:${chat.id}`);
      router.replace(`/character/${chat.characterId}`);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Couldn't delete", "error");
    }
  }

  async function blockCreator() {
    if (!confirm(`Block ${chat.character.creator.displayName}? Their characters will disappear from your feeds.`)) return;
    try {
      await api(`/api/users/${chat.character.creator.id}/block`, { method: "POST" });
      router.replace("/explore");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Couldn't block", "error");
    }
  }

  const c = chat.character;
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-bg" style={{ paddingTop: "var(--safe-top)" }}>
      {/* Header */}
      <header className="glass flex h-14 items-center gap-2 border-b border-line px-2">
        <button onClick={() => router.back()} className="rounded-full p-2 text-fg-2 hover:bg-surface-2 focus-ring" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Link href={`/character/${c.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg focus-ring">
          <Avatar name={c.name} seed={c.avatarSeed} src={c.avatarUrl} size={36} rounded="rounded-full" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium">{c.name}</span>
              <IntensityBadge level={c.intensity} />
              {chat.isPreview && <span className="rounded-md bg-gold-soft px-1.5 text-[10px] font-semibold uppercase text-gold">Preview</span>}
            </span>
            <span className="block truncate text-[11px] text-muted">{chat.title !== c.name ? chat.title : c.tagline}</span>
          </span>
        </Link>
        <button onClick={() => setBoundaries(true)} className="rounded-full p-2 text-fg-2 hover:bg-surface-2 focus-ring" aria-label="Boundaries and limits">
          <Hand className="h-5 w-5" />
        </button>
        <button onClick={() => setMenu(true)} className="rounded-full p-2 text-fg-2 hover:bg-surface-2 focus-ring" aria-label="Chat menu">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4" role="log" aria-live="polite">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {chat.context?.hook && (
            <div className="card mx-auto max-w-md p-3 text-center text-xs text-muted">
              <span className="font-medium text-fg-2">{chat.context.scenarioTitle ?? "Scene"}</span>
              {chat.context.setting && <> · {chat.context.setting}</>}
              <p className="mt-1 italic">{chat.context.hook}</p>
            </div>
          )}
          {messages.length === 0 && !streaming && <p className="py-10 text-center text-sm text-muted">Say something to begin.</p>}
          {messages.map((m) => (
            <MessageBubble key={m.id} m={m} character={c} isLastAssistant={m.id === lastAssistantId} busy={busy} onRegenerate={() => regenerate(m)} onDelete={() => remove(m)} onEdit={() => setEditing(m)} onCopy={() => navigator.clipboard?.writeText(m.content).then(() => toast.push("Copied"))} />
          ))}
          {streaming !== null && (
            <div className="flex items-end gap-2 fade-up">
              <Avatar name={c.name} seed={c.avatarSeed} src={c.avatarUrl} size={28} rounded="rounded-full" />
              <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed">
                {streaming ? <RichText text={streaming} /> : (
                  <span className="inline-flex gap-1 py-1" aria-label={`${c.name} is typing`}>
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-fg-2" /><span className="typing-dot h-1.5 w-1.5 rounded-full bg-fg-2" /><span className="typing-dot h-1.5 w-1.5 rounded-full bg-fg-2" />
                  </span>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="glass border-t border-line px-3 pb-[calc(0.75rem+var(--safe-bottom))] pt-2">
        <div className="mx-auto max-w-2xl">
          {blocked && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{blocked} Your message was not sent or stored.</span>
            </div>
          )}
          <div className="mb-2 flex gap-2 overflow-x-auto scrollbar-none">
            <button onClick={() => send("Stop. Let's pause the scene for a moment.")} className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1 text-[11px] text-fg-2 hover:border-line-2 focus-ring" disabled={busy}>Pause scene</button>
            <button onClick={() => send("(OOC: Let's slow things down and keep it gentler.)")} className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1 text-[11px] text-fg-2 hover:border-line-2 focus-ring" disabled={busy}>Slow down</button>
            <button onClick={() => send("*I look up at you, waiting to see what you'll do next.*")} className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1 text-[11px] text-fg-2 hover:border-line-2 focus-ring" disabled={busy}>Continue</button>
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autosize();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder={`Message ${c.name}…`}
              aria-label="Message"
              className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-sm leading-relaxed text-fg placeholder:text-muted focus:border-accent/60 focus:outline-none"
            />
            {busy && streaming !== null ? (
              <Button type="button" variant="secondary" size="icon" onClick={stop} aria-label="Stop generating"><Square className="h-4 w-4" /></Button>
            ) : (
              <Button type="submit" size="icon" disabled={!input.trim() || busy} aria-label="Send"><Send className="h-4 w-4" /></Button>
            )}
          </form>
        </div>
      </div>

      {/* Boundaries sheet */}
      <Sheet open={boundaries} onClose={() => setBoundaries(false)} title="Consent & boundaries">
        <div className="space-y-4 text-sm">
          <p className="text-muted">Say <span className="text-fg">stop</span>, <span className="text-fg">pause</span> or use <span className="text-fg">(OOC: …)</span> at any time to step out of the scene. {c.name} will drop character immediately.</p>
          <div>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">{c.name}&apos;s boundaries</h3>
            <p className="text-fg-2">{initial.boundaries || "No specific boundaries listed beyond the platform rules."}</p>
          </div>
          <div>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">Your hard limits</h3>
            <p className="text-fg-2">{[initial.hardLimits, chat.context?.hardLimits].filter(Boolean).join("; ") || "None set. Add hard limits in Blackbook › Profile and they'll apply to every chat."}</p>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Everything here is fiction between adults. Content involving minors, real people, non-consent, incest, bestiality or anything illegal is blocked before it reaches the model.</p>
        </div>
      </Sheet>

      {/* Menu sheet */}
      <Sheet open={menu} onClose={() => setMenu(false)} title="Chat options">
        <div className="space-y-4">
          <Field label="Chat title">
            <Input defaultValue={chat.title} onBlur={(e) => e.target.value.trim() && e.target.value !== chat.title && updateChat({ title: e.target.value.trim() })} maxLength={80} />
          </Field>
          <Field label="Your persona" hint="Manage personas in Blackbook › Personas.">
            <Select value={chat.personaId ?? ""} onChange={(e) => updateChat({ personaId: e.target.value || null })}>
              <option value="">Just me</option>
              {initial.personas.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.isDefault ? " (default)" : ""}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" href={`/api/chats/${chat.id}/export?download=1`}><Download className="h-4 w-4" /> Export</Button>
            <Button variant="secondary" href={`/stories/new?chatId=${chat.id}`}>Story from chat</Button>
            <Button variant="secondary" href={`/comics/new?chatId=${chat.id}`}>Comic from chat</Button>
            <Button variant="secondary" onClick={() => updateChat({ archived: !chat.archived })}>{chat.archived ? "Unarchive" : "Archive"}</Button>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <ReportButton targetType="CHARACTER" targetId={c.id} variant="outline" />
            {!c.isOwner && <Button variant="outline" size="sm" onClick={blockCreator}>Block creator</Button>}
            <Button variant="outline" size="sm" onClick={() => confirm("Clear all messages in this chat?") && updateChat({ clear: true })}>Clear messages</Button>
            <Button variant="danger" size="sm" onClick={deleteChat}><Trash2 className="h-3.5 w-3.5" /> Delete chat</Button>
          </div>
          <p className="text-[11px] text-muted">Messages are encrypted at rest and never shown to anyone else. Chat started {timeAgo(chat.createdAt)}.</p>
        </div>
      </Sheet>

      {/* Edit sheet */}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit message">
        {editing && (
          <div className="space-y-3">
            <Textarea value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} rows={5} />
            <Button className="w-full" onClick={saveEdit}>Save</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function MessageBubble({ m, character, isLastAssistant, busy, onRegenerate, onDelete, onEdit, onCopy }: { m: MessageDto; character: ChatDto["character"]; isLastAssistant: boolean; busy: boolean; onRegenerate: () => void; onDelete: () => void; onEdit: () => void; onCopy: () => void }) {
  const [open, setOpen] = React.useState(false);
  const mine = m.role === "user";
  return (
    <div className={cn("group flex items-end gap-2 fade-up", mine && "flex-row-reverse")}>
      {!mine && <Avatar name={character.name} seed={character.avatarSeed} src={character.avatarUrl} size={28} rounded="rounded-full" />}
      <div className={cn("relative max-w-[85%]", mine ? "items-end" : "items-start")}>
        <button type="button" onClick={() => setOpen((o) => !o)} className={cn("block w-full rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed focus-ring", mine ? "rounded-br-md bg-accent text-white" : "rounded-bl-md bg-surface-2 text-fg", m.pending && "opacity-60")} aria-label={`${mine ? "Your" : character.name + "'s"} message. Tap for actions.`}>
          <RichText text={m.content} />
        </button>
        <div className={cn("mt-1 flex items-center gap-1 text-[10px] text-muted", mine ? "justify-end" : "justify-start")}>
          <span>{m.pending ? "Queued · sends when online" : timeAgo(m.createdAt)}</span>
        </div>
        {open && (
          <div className={cn("absolute top-full z-10 mt-1 flex gap-1 rounded-xl border border-line bg-surface-3 p-1 shadow-lg", mine ? "right-0" : "left-0")} role="menu">
            <IconBtn label="Copy" onClick={() => { onCopy(); setOpen(false); }}><Copy className="h-3.5 w-3.5" /></IconBtn>
            {mine && !m.pending && <IconBtn label="Edit" onClick={() => { onEdit(); setOpen(false); }}><Pencil className="h-3.5 w-3.5" /></IconBtn>}
            {!mine && isLastAssistant && <IconBtn label="Regenerate" onClick={() => { onRegenerate(); setOpen(false); }} disabled={busy}><RefreshCw className="h-3.5 w-3.5" /></IconBtn>}
            <IconBtn label="Delete" onClick={() => { onDelete(); setOpen(false); }}><Trash2 className="h-3.5 w-3.5 text-danger" /></IconBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="rounded-lg p-2 text-fg-2 hover:bg-surface-2 focus-ring disabled:opacity-40">
      {children}
    </button>
  );
}
