"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, Link2, Lock, MoreHorizontal, PenSquare, Plus, Sparkles } from "lucide-react";
import { Avatar, Button, EmptyState, IntensityBadge } from "@/components/ui";
import type { CharacterCard } from "@/lib/characters";
import type { EngagementStats } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import { ActionsSheet, DeleteCharacterSheet, useCharacterActions } from "./character-actions";
import { StatsBar } from "./stats-bar";

export type OwnedCharacter = { card: CharacterCard; stats: EngagementStats; updatedAt: string };

const VIS_ICON = { PUBLIC: Globe, UNLISTED: Link2, PRIVATE: Lock } as const;

export function MyCharacters({ items: initial }: { items: OwnedCharacter[] }) {
  const router = useRouter();
  const actions = useCharacterActions();
  const [items, setItems] = React.useState(initial);
  const [menuFor, setMenuFor] = React.useState<OwnedCharacter | null>(null);
  const [deleteFor, setDeleteFor] = React.useState<OwnedCharacter | null>(null);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-8 w-8" />}
        title="No characters yet"
        description="Build someone worth staying up late for. Everything starts private; publish only when you're ready."
        action={
          <Button href="/create/new">
            <Plus className="h-4 w-4" /> New character
          </Button>
        }
      />
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {items.map((it) => {
          const c = it.card;
          const Vis = VIS_ICON[c.visibility as keyof typeof VIS_ICON] ?? Lock;
          return (
            <li key={c.id} className="card card-hover fade-up flex gap-3 p-3">
              <Link href={`/create/${c.id}`} className="shrink-0 focus-ring rounded-2xl" aria-label={`Edit ${c.name}`}>
                <Avatar name={c.name} seed={c.avatarSeed} src={c.avatarUrl} size={72} />
              </Link>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/create/${c.id}`} className="block truncate font-display text-base leading-tight text-fg hover:text-accent-2 focus-ring rounded">{c.name}</Link>
                    <p className="line-clamp-1 text-xs text-muted">{c.tagline || "No tagline yet"}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`More actions for ${c.name}`} onClick={() => setMenuFor(it)}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1"><Vis className="h-3 w-3" /> {c.visibility.toLowerCase()}</span>
                  <IntensityBadge level={c.intensity} />
                  {c.status !== "ACTIVE" && <span className="rounded-md border border-danger/30 bg-danger/15 px-1.5 text-[10px] font-semibold uppercase text-danger">{c.status.toLowerCase()}</span>}
                  <span>· edited {timeAgo(it.updatedAt)}</span>
                </div>
                <StatsBar stats={it.stats} dense />
                <div className="flex gap-2 pt-1">
                  <Button href={`/create/${c.id}`} variant="secondary" size="sm">
                    <PenSquare className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => actions.testChat(c.id)} loading={actions.busy === "test"}>
                    Test chat
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <ActionsSheet
        open={!!menuFor}
        onClose={() => setMenuFor(null)}
        busy={actions.busy}
        onTestChat={() => menuFor && actions.testChat(menuFor.card.id)}
        onDuplicate={() => menuFor && actions.duplicate(menuFor.card.id)}
        onExport={() => menuFor && actions.exportJson(menuFor.card.id)}
        onDelete={() => { setDeleteFor(menuFor); setMenuFor(null); }}
      />
      <DeleteCharacterSheet
        open={!!deleteFor}
        name={deleteFor?.card.name ?? ""}
        onClose={() => setDeleteFor(null)}
        loading={actions.busy === "delete"}
        onConfirm={async () => {
          if (!deleteFor) return;
          if (await actions.remove(deleteFor.card.id)) {
            setItems((list) => list.filter((x) => x.card.id !== deleteFor.card.id));
            router.refresh();
          }
          setDeleteFor(null);
        }}
      />
    </>
  );
}
