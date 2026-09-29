"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Avatar, Button, useToast } from "@/components/ui";
import { api } from "@/lib/offline/client";
import type { ChatContext } from "@/lib/types";

export type CharacterLinkItem = { id: string; name: string; avatarUrl: string | null; avatarSeed: string };

/** "Chat with <character>" links to the profile, with an optional direct "Start chat" that opens a chat seeded with a context hook. */
export function CharacterLinks({ characters, context, className }: { characters: CharacterLinkItem[]; context?: ChatContext; className?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [starting, setStarting] = React.useState<string | null>(null);
  if (characters.length === 0) return null;
  async function start(id: string) {
    setStarting(id);
    try {
      const res = await api<{ id: string }>("/api/chats", { method: "POST", json: { characterId: id, context } });
      router.push(`/chat/${res.id}`);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not start chat", "error");
      setStarting(null);
    }
  }
  return (
    <div className={className}>
      <ul className="flex flex-col gap-2">
        {characters.map((c) => (
          <li key={c.id} className="card flex items-center gap-3 p-2.5">
            <Avatar name={c.name} seed={c.avatarSeed} src={c.avatarUrl} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-fg">{c.name}</p>
              <p className="text-[11px] text-muted">Featured character</p>
            </div>
            <Button variant="outline" size="sm" href={`/character/${c.id}`}>Chat with {c.name.split(" ")[0]}</Button>
            {context && (
              <Button size="sm" onClick={() => start(c.id)} loading={starting === c.id} aria-label={`Start a chat with ${c.name} from this scene`}>
                <MessageCircle className="h-3.5 w-3.5" /> Start
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
