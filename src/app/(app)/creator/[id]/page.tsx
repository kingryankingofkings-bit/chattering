import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Ban } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { decryptJson, decryptString } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { defaultPrefs, type UserPrefs } from "@/lib/types";
import { compact } from "@/lib/utils";
import { BlockCreatorButton, FollowButton } from "@/components/character/creator-actions";
import { ReportButton } from "@/components/character/report-button";
import { CharacterGrid } from "@/components/explore/character-grid";
import { Avatar, Button, SectionTitle } from "@/components/ui";

async function loadCreator(id: string) {
  return prisma.user.findUnique({ where: { id }, select: { id: true, displayName: true, bioEnc: true, prefsEnc: true, deletedAt: true, createdAt: true } });
}

export async function generateMetadata({ params }: PageProps<"/creator/[id]">): Promise<Metadata> {
  const { id } = await params;
  const u = await loadCreator(id);
  return { title: u && !u.deletedAt ? u.displayName : "Creator" };
}

export default async function CreatorPage({ params }: PageProps<"/creator/[id]">) {
  const { id } = await params;
  const [user, creator] = await Promise.all([getCurrentUser(), loadCreator(id)]);
  if (!creator || creator.deletedAt) notFound();
  const viewerId = user?.id ?? null;
  const isSelf = viewerId === creator.id;
  const creatorPrefs = decryptJson<UserPrefs>(creator.prefsEnc, defaultPrefs());
  const viewerPrefs = decryptJson<UserPrefs>(user?.prefsEnc, defaultPrefs());
  const publicProfile = creatorPrefs.showPublicProfile || isSelf;

  const [followerCount, characterCount, follow, block] = await Promise.all([
    prisma.follow.count({ where: { creatorId: creator.id } }),
    prisma.character.count({ where: { ownerId: creator.id, visibility: "PUBLIC", status: "ACTIVE" } }),
    viewerId && !isSelf ? prisma.follow.findUnique({ where: { followerId_creatorId: { followerId: viewerId, creatorId: creator.id } } }) : null,
    viewerId && !isSelf ? prisma.block.findUnique({ where: { userId_blockedUserId: { userId: viewerId, blockedUserId: creator.id } } }) : null,
  ]);
  const bio = publicProfile && creator.bioEnc ? safeDecrypt(creator.bioEnc) : "";
  const blocked = !!block;

  return (
    <div className="space-y-6 fade-up">
      <header className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <Avatar name={creator.displayName} seed={creator.id} size={72} rounded="rounded-full" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl">{creator.displayName}</h1>
          <p className="text-xs text-muted">
            {compact(characterCount)} public character{characterCount === 1 ? "" : "s"} · {compact(followerCount)} follower{followerCount === 1 ? "" : "s"}
          </p>
          {bio ? <p className="mt-2 text-sm leading-relaxed text-fg-2">{bio}</p> : !publicProfile ? <p className="mt-2 text-xs text-muted">This creator keeps their profile private.</p> : null}
        </div>
        {!isSelf && (
          <div className="flex flex-wrap gap-2">
            <FollowButton creatorId={creator.id} initial={!!follow} allowFollows={creatorPrefs.allowFollows && !blocked} size="md" />
            <BlockCreatorButton creatorId={creator.id} creatorName={creator.displayName} initial={blocked} size="md" variant="outline" />
            <ReportButton targetType="USER" targetId={creator.id} size="md" />
          </div>
        )}
        {isSelf && <Button href="/create" variant="secondary">Manage characters</Button>}
      </header>

      <section aria-label="Characters">
        <SectionTitle title="Characters" subtitle={isSelf ? "Only your public characters appear here" : undefined} />
        {blocked ? (
          <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Ban className="h-7 w-7 text-muted" aria-hidden />
            <p className="text-sm text-muted">You&apos;ve blocked {creator.displayName}, so their characters are hidden. Unblock them above to browse again.</p>
          </div>
        ) : (
          <CharacterGrid url={`/api/characters?creator=${encodeURIComponent(creator.id)}&sort=newest`} blur={viewerPrefs.blurNsfw} emptyTitle="No public characters yet" emptyDescription={isSelf ? "Publish a character from the Create tab and it will show up here." : "Check back later — creators publish new characters often."} />
        )}
      </section>
    </div>
  );
}

function safeDecrypt(v: string): string {
  try {
    return decryptString(v);
  } catch {
    return "";
  }
}
