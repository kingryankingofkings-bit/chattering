"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Heart, MessageCircle, MessagesSquare, Pencil, Play, ShieldAlert, Star } from "lucide-react";
import { FavoriteButton } from "@/components/character/character-card";
import { BlockCreatorButton, FollowButton } from "@/components/character/creator-actions";
import { ReportButton } from "@/components/character/report-button";
import { Avatar, BlurGuard, Button, Chip, IntensityBadge, Skeleton, Stars, useToast } from "@/components/ui";
import type { CharacterCard } from "@/lib/characters";
import { api, ApiClientError } from "@/lib/offline/client";
import { compact, timeAgo } from "@/lib/utils";

/** The subset of the encrypted sheet that is safe to show to any viewer. */
export type PublicSheet = {
  scenario: string;
  setting: string;
  openingMessage: string;
  personality: string;
  speakingStyle: string;
  likes: string;
  dislikes: string;
  relationshipStyle: string;
};

export type ProfileCreator = {
  id: string;
  displayName: string;
  followerCount: number;
  characterCount: number;
  isFollowing: boolean;
  isBlocked: boolean;
  allowFollows: boolean;
};

export type ProfileProps = {
  card: CharacterCard;
  sheet: PublicSheet;
  creator: ProfileCreator;
  identity: string;
  appearance: string;
  views: number;
  isOwner: boolean;
  isMod: boolean;
  blur: boolean;
  /** Shown to owner/mod when the character is HIDDEN or REMOVED. */
  moderationNotice?: string | null;
};

type ChatSummary = { id: string; title: string; lastMessageAt: string; messageCount: number };

export function CharacterProfile({ card, sheet, creator, identity, appearance, views, isOwner, isMod, blur, moderationNotice }: ProfileProps) {
  const router = useRouter();
  const toast = useToast();
  const [starting, setStarting] = React.useState(false);
  const [rating, setRating] = React.useState<{ avg: number | null; count: number; mine: number | null }>({ avg: card.rating, count: card.ratingCount, mine: card.userRating ?? null });
  const [ratingBusy, setRatingBusy] = React.useState(false);
  const [chats, setChats] = React.useState<ChatSummary[] | null | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    api<{ items: ChatSummary[] }>(`/api/chats?characterId=${encodeURIComponent(card.id)}`)
      .then((r) => !cancelled && setChats(Array.isArray(r?.items) ? r.items : []))
      .catch(() => !cancelled && setChats(null));
    return () => {
      cancelled = true;
    };
  }, [card.id]);

  async function startChat() {
    setStarting(true);
    try {
      const { id } = await api<{ id: string }>("/api/chats", { method: "POST", json: { characterId: card.id, context: { version: 1, origin: "explore" } } });
      router.push(`/chat/${id}`);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not start chat", "error");
      setStarting(false);
    }
  }

  async function rate(score: number) {
    if (isOwner || ratingBusy) return;
    setRatingBusy(true);
    try {
      const r = await api<{ rating: number | null; ratingCount: number }>(`/api/characters/${card.id}/rate`, { method: "POST", json: { score } });
      setRating({ avg: r.rating === null ? null : Math.round(r.rating * 10) / 10, count: r.ratingCount, mine: score });
      toast.push(`Rated ${score} star${score > 1 ? "s" : ""}`, "success");
    } catch (err) {
      toast.push(err instanceof ApiClientError ? err.message : "Could not save rating", "error");
    } finally {
      setRatingBusy(false);
    }
  }

  const facts = [
    { label: "Pronouns", value: card.pronouns },
    { label: "Identity", value: identity },
    { label: "Presents", value: card.genderPresentation },
    { label: "Orientation", value: card.orientation },
    { label: "Personality", value: card.personalityType },
    { label: "Role", value: card.roleType },
  ].filter((f) => f.value);

  const sections: { title: string; body: string }[] = [
    { title: "Appearance", body: appearance },
    { title: "Personality", body: sheet.personality },
    { title: "How they talk", body: sheet.speakingStyle },
    { title: "Likes", body: sheet.likes },
    { title: "Dislikes", body: sheet.dislikes },
    { title: "Relationship style", body: sheet.relationshipStyle },
  ].filter((s) => s.body.trim());

  return (
    <article className="space-y-6 fade-up">
      {moderationNotice && (
        <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning" role="status">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> {moderationNotice}
        </p>
      )}

      {/* Hero */}
      <header className="card overflow-hidden">
        <div className="relative aspect-[4/5] w-full sm:aspect-[16/10]">
          <BlurGuard enabled={blur && card.intensity >= 2} className="h-full w-full">
            <Avatar name={card.name} seed={card.avatarSeed} src={card.avatarUrl} size={800} rounded="rounded-none" className="!h-full !w-full" />
          </BlurGuard>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-bg via-bg/60 to-transparent" />
          <div className="absolute left-3 top-3 flex gap-1.5">
            <IntensityBadge level={card.intensity} />
            {card.visibility !== "PUBLIC" && <span className="inline-flex h-5 items-center rounded-md border border-line-2 bg-black/50 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">{card.visibility.toLowerCase()}</span>}
          </div>
          <div className="absolute right-3 top-3">
            <FavoriteButton characterId={card.id} initial={!!card.isFavorite} count={card.favoriteCount} />
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <h1 className="text-3xl leading-tight text-white drop-shadow sm:text-4xl">{card.name}</h1>
            <p className="mt-1 max-w-xl text-sm text-white/85">{card.tagline}</p>
            <p className="mt-2 text-xs text-white/70">
              by{" "}
              <Link href={`/creator/${creator.id}`} className="font-medium text-white underline-offset-2 hover:underline focus-ring">
                {creator.displayName}
              </Link>
              {" · "}
              {timeAgo(card.createdAt)}
            </p>
          </div>
        </div>

        {/* Stats + primary actions */}
        <div className="space-y-3 p-4">
          <dl className="grid grid-cols-4 gap-2 text-center">
            <Stat icon={<MessageCircle className="h-3.5 w-3.5" />} label="Chats" value={compact(card.chatCount)} />
            <Stat icon={<Heart className="h-3.5 w-3.5" />} label="Favorites" value={compact(card.favoriteCount)} />
            <Stat icon={<Star className="h-3.5 w-3.5" />} label="Rating" value={rating.avg === null ? "—" : rating.avg.toFixed(1)} sub={rating.count ? `${compact(rating.count)} votes` : "no votes yet"} />
            <Stat icon={<Eye className="h-3.5 w-3.5" />} label="Views" value={compact(views)} />
          </dl>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" className="flex-1" loading={starting} onClick={startChat}>
              <Play className="h-4 w-4" fill="currentColor" /> Start chat
            </Button>
            {isOwner && (
              <Button size="lg" variant="secondary" href={`/create/${card.id}`}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            )}
          </div>
          {!isOwner && (
            <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
              <span className="text-xs text-muted">{rating.mine ? `Your rating: ${rating.mine}/5` : "Rate this character"}</span>
              <Stars value={rating.mine ?? 0} onChange={rate} size={20} />
            </div>
          )}
        </div>
      </header>

      {/* Continue existing chats */}
      {chats !== null && (
        <section aria-labelledby="continue-h">
          <h2 id="continue-h" className="mb-2 text-lg">Continue</h2>
          {chats === undefined ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : chats.length === 0 ? (
            <p className="card px-4 py-3 text-sm text-muted">You haven&apos;t talked to {card.name} yet. Start a chat to pick up the thread later.</p>
          ) : (
            <ul className="space-y-2">
              {chats.slice(0, 6).map((ch) => (
                <li key={ch.id}>
                  <Link href={`/chat/${ch.id}`} className="card card-hover flex items-center gap-3 px-4 py-3 focus-ring">
                    <MessagesSquare className="h-4 w-4 shrink-0 text-accent-2" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{ch.title || `Chat with ${card.name}`}</span>
                      <span className="block text-xs text-muted">
                        {ch.messageCount} message{ch.messageCount === 1 ? "" : "s"} · {timeAgo(ch.lastMessageAt)}
                      </span>
                    </span>
                    <span className="text-xs text-accent-2">Resume</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* About */}
      <section aria-labelledby="about-h" className="card space-y-4 p-4">
        <h2 id="about-h" className="text-lg">About {card.name}</h2>
        <p className="text-sm leading-relaxed text-fg-2">{card.description}</p>
        {facts.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-[11px] uppercase tracking-wider text-muted">{f.label}</dt>
                <dd className="capitalize text-fg">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {(card.themes.length > 0 || card.tags.length > 0) && (
          <div className="space-y-2">
            {card.themes.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Themes">
                {card.themes.map((t) => (
                  <Link key={t} href={`/explore?themes=${encodeURIComponent(t)}`} className="focus-ring rounded-full">
                    <Chip tone="gold">{t}</Chip>
                  </Link>
                ))}
              </div>
            )}
            {card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Tags">
                {card.tags.map((t) => (
                  <Link key={t} href={`/explore?tags=${encodeURIComponent(t)}`} className="focus-ring rounded-full">
                    <Chip>{t}</Chip>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
        {sections.map((s) => (
          <div key={s.title}>
            <h3 className="mb-1 text-[11px] uppercase tracking-wider text-muted">{s.title}</h3>
            <p className="text-sm leading-relaxed text-fg-2">{s.body}</p>
          </div>
        ))}
      </section>

      {/* Scenario */}
      {(sheet.scenario || sheet.setting || sheet.openingMessage) && (
        <section aria-labelledby="scene-h" className="card space-y-4 p-4">
          <h2 id="scene-h" className="text-lg">The scene</h2>
          {sheet.setting && (
            <div>
              <h3 className="mb-1 text-[11px] uppercase tracking-wider text-muted">Setting</h3>
              <p className="text-sm leading-relaxed text-fg-2">{sheet.setting}</p>
            </div>
          )}
          {sheet.scenario && (
            <div>
              <h3 className="mb-1 text-[11px] uppercase tracking-wider text-muted">Scenario</h3>
              <p className="text-sm leading-relaxed text-fg-2">{sheet.scenario}</p>
            </div>
          )}
          {sheet.openingMessage && (
            <div>
              <h3 className="mb-1 text-[11px] uppercase tracking-wider text-muted">Opening line</h3>
              <blockquote className="rounded-xl border-l-2 border-accent bg-surface-2 px-4 py-3 text-sm italic leading-relaxed text-fg">{sheet.openingMessage}</blockquote>
            </div>
          )}
        </section>
      )}

      {/* Creator */}
      <section aria-labelledby="creator-h" className="card flex items-center gap-3 p-4">
        <Avatar name={creator.displayName} seed={creator.id} size={44} rounded="rounded-full" />
        <div className="min-w-0 flex-1">
          <h2 id="creator-h" className="truncate text-base">
            <Link href={`/creator/${creator.id}`} className="hover:underline focus-ring">{creator.displayName}</Link>
          </h2>
          <p className="text-xs text-muted">
            {compact(creator.characterCount)} character{creator.characterCount === 1 ? "" : "s"} · {compact(creator.followerCount)} follower{creator.followerCount === 1 ? "" : "s"}
          </p>
        </div>
        {!isOwner && <FollowButton creatorId={creator.id} initial={creator.isFollowing} allowFollows={creator.allowFollows && !creator.isBlocked} />}
      </section>

      {/* Safety actions */}
      {!isOwner && (
        <div className="flex flex-wrap items-center justify-end gap-1 pb-2">
          <ReportButton targetType="CHARACTER" targetId={card.id} />
          <BlockCreatorButton creatorId={creator.id} creatorName={creator.displayName} initial={creator.isBlocked} afterBlock={() => router.push("/explore")} />
        </div>
      )}
      {isMod && !isOwner && <p className="text-right text-[11px] text-muted">Viewing as moderator · status {card.status}</p>}
    </article>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2">
      <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-muted">
        {icon} {label}
      </dt>
      <dd className="mt-0.5 font-display text-lg leading-none text-fg">{value}</dd>
      {sub && <dd className="mt-1 text-[10px] text-muted">{sub}</dd>}
    </div>
  );
}
