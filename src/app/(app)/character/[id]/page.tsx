import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser, isModerator } from "@/lib/auth";
import { cardInclude, canView, getSheet, toCard, viewerMarks } from "@/lib/characters";
import { decryptJson } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { defaultPrefs, type UserPrefs } from "@/lib/types";
import { CharacterProfile, type PublicSheet } from "@/components/character/profile";
import { Button, EmptyState } from "@/components/ui";

async function load(id: string) {
  return prisma.character.findUnique({ where: { id }, include: cardInclude });
}

export async function generateMetadata({ params }: PageProps<"/character/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [user, c] = await Promise.all([getCurrentUser(), load(id)]);
  if (!c || !canView(c, user?.id ?? null, isModerator(user))) return { title: "Character" };
  return { title: c.name, description: c.tagline };
}

export default async function CharacterPage({ params }: PageProps<"/character/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;
  const mod = isModerator(user);
  const c = await load(id);
  if (!c) notFound();
  const isOwner = c.ownerId === viewerId;

  // Private → 404 (don't confirm it exists). Hidden/removed → "under review" unless owner/mod.
  if (c.visibility === "PRIVATE" && !isOwner && !mod) notFound();
  if (c.status !== "ACTIVE" && !isOwner && !mod) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-8 w-8" />}
        title="This character is under review"
        description="A moderator is taking a look. It may come back once the review is done, or it may stay hidden."
        action={<Button href="/explore" variant="secondary">Back to Explore</Button>}
      />
    );
  }

  const prefs = decryptJson<UserPrefs>(user?.prefsEnc, defaultPrefs());
  const ownerPrefs = decryptJson<UserPrefs>(c.owner.id === viewerId ? user?.prefsEnc : (await prisma.user.findUnique({ where: { id: c.ownerId }, select: { prefsEnc: true } }))?.prefsEnc, defaultPrefs());

  const [marks, followerCount, characterCount, follow, block] = await Promise.all([
    viewerMarks(viewerId, [c.id]),
    prisma.follow.count({ where: { creatorId: c.ownerId } }),
    prisma.character.count({ where: { ownerId: c.ownerId, visibility: "PUBLIC", status: "ACTIVE" } }),
    viewerId && !isOwner ? prisma.follow.findUnique({ where: { followerId_creatorId: { followerId: viewerId, creatorId: c.ownerId } } }) : null,
    viewerId && !isOwner ? prisma.block.findUnique({ where: { userId_blockedUserId: { userId: viewerId, blockedUserId: c.ownerId } } }) : null,
  ]);

  // Fire-and-forget view counter (never for the owner's own visits).
  if (!isOwner) void prisma.character.update({ where: { id: c.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const full = getSheet(c);
  const sheet: PublicSheet = {
    scenario: full.scenario,
    setting: full.setting,
    openingMessage: full.openingMessage,
    personality: full.personality,
    speakingStyle: full.speakingStyle,
    likes: full.likes,
    dislikes: full.dislikes,
    relationshipStyle: full.relationshipStyle,
  };
  const card = toCard(c, viewerId ? { id: viewerId, ...marks } : undefined);
  const moderationNotice =
    c.status === "HIDDEN" ? "This character is hidden while a moderator reviews it. Only you (and moderators) can see this page." : c.status === "REMOVED" ? "This character was removed by moderation. Only you (and moderators) can see this page." : null;

  return (
    <CharacterProfile
      card={card}
      sheet={sheet}
      identity={c.identity}
      appearance={c.appearance}
      views={c.viewCount + (isOwner ? 0 : 1)}
      creator={{
        id: c.owner.id,
        displayName: c.owner.displayName,
        followerCount,
        characterCount,
        isFollowing: !!follow,
        isBlocked: !!block,
        allowFollows: ownerPrefs.allowFollows,
      }}
      isOwner={isOwner}
      isMod={mod}
      blur={prefs.blurNsfw}
      moderationNotice={moderationNotice}
    />
  );
}
