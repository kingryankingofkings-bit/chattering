import "server-only";
import type { GeneratedImage, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { decryptString, encryptString } from "./crypto";
import { getImageProvider } from "./ai";
import { storeMedia } from "./storage";
import { ApiError, parseJsonArray } from "./api";
import type { SafeUser } from "./auth";
import { authorSelect, characterLinkSelect, isFollowing, isOwnerOrMod, mediaUrl, reactionBreakdown, seed31, toCharacterLink, trackGeneration, viewerContentMarks, type Author, type CharacterLink, type ViewerMarks } from "./content";

export type GenerateImageOpts = {
  prompt: string;
  negativePrompt?: string;
  style: string;
  orientation: "portrait" | "landscape" | "square";
  intensity: number;
  seed?: number;
  title?: string;
  tags: string[];
  character?: { id: string; name: string; appearance: string } | null;
  parentImageId?: string | null;
  showDetails?: boolean;
  allowRemix?: boolean;
};

/** Generates one PRIVATE draft image, storing media + a GeneratedImage row. */
export async function generateOneImage(user: SafeUser, o: GenerateImageOpts): Promise<GeneratedImage> {
  const images = getImageProvider();
  const seed = seed31(o.seed ?? Math.floor(Math.random() * 2147483647));
  const img = await trackGeneration(user.id, "IMAGE", { provider: images.name, model: images.model }, () =>
    images.generate({ prompt: o.prompt, negativePrompt: o.negativePrompt, style: o.style, orientation: o.orientation, seed, characterSheet: o.character ? `${o.character.name}: ${o.character.appearance}` : undefined }),
  );
  const media = await storeMedia({ ownerId: user.id, data: img.data, mime: img.mime, width: img.width, height: img.height, visibility: "PRIVATE" });
  return prisma.generatedImage.create({
    data: {
      ownerId: user.id,
      mediaId: media.id,
      title: o.title ?? "",
      promptEnc: encryptString(o.prompt),
      negativeEnc: o.negativePrompt ? encryptString(o.negativePrompt) : null,
      style: o.style,
      seed: seed31(img.seed ?? seed),
      orientation: o.orientation,
      intensity: o.intensity,
      tags: JSON.stringify(o.tags),
      characterId: o.character?.id ?? null,
      provider: img.provider,
      model: img.model,
      parentImageId: o.parentImageId ?? null,
      showDetails: o.showDetails ?? true,
      allowRemix: o.allowRemix ?? true,
      status: "DRAFT",
      visibility: "PRIVATE",
    },
  });
}

export function decryptPrompt(v: string | null): string {
  if (!v) return "";
  try {
    return decryptString(v);
  } catch {
    return "";
  }
}

/* ---------------- Client shapes ---------------- */

export type ImageCard = {
  id: string;
  url: string;
  title: string;
  style: string;
  orientation: string;
  intensity: number;
  tags: string[];
  width: number | null;
  height: number | null;
  owner: Author;
  character: CharacterLink | null;
  likeCount: number;
  saveCount: number;
  viewCount: number;
  status: string;
  visibility: string;
  modStatus: string;
  createdAt: string;
  publishedAt: string | null;
  isOwner: boolean;
  isFavorite: boolean;
  reaction: string | null;
};

export type ImageWithRelations = GeneratedImage & { owner: Author; character: { id: string; name: string; avatarMediaId: string | null; avatarSeed: string } | null };
export const imageInclude = { owner: { select: authorSelect }, character: { select: characterLinkSelect } } as const;

export function toImageCard(g: ImageWithRelations, viewerId: string | null, marks?: ViewerMarks, dims?: Map<string, { width: number | null; height: number | null }>): ImageCard {
  const d = dims?.get(g.mediaId);
  return {
    id: g.id,
    url: mediaUrl(g.mediaId)!,
    title: g.title,
    style: g.style,
    orientation: g.orientation,
    intensity: g.intensity,
    tags: parseJsonArray(g.tags),
    width: d?.width ?? null,
    height: d?.height ?? null,
    owner: g.owner,
    character: g.character ? toCharacterLink(g.character) : null,
    likeCount: g.likeCount,
    saveCount: g.saveCount,
    viewCount: g.viewCount,
    status: g.status,
    visibility: g.visibility,
    modStatus: g.modStatus,
    createdAt: g.createdAt.toISOString(),
    publishedAt: g.publishedAt?.toISOString() ?? null,
    isOwner: g.ownerId === viewerId,
    isFavorite: marks?.favorites.has(g.id) ?? false,
    reaction: marks?.reactions.get(g.id) ?? null,
  };
}

export async function mediaDims(mediaIds: string[]) {
  if (mediaIds.length === 0) return new Map<string, { width: number | null; height: number | null }>();
  const rows = await prisma.media.findMany({ where: { id: { in: mediaIds } }, select: { id: true, width: true, height: true } });
  return new Map(rows.map((r) => [r.id, { width: r.width, height: r.height }]));
}

export type ImageDetail = ImageCard & {
  showDetails: boolean;
  allowRemix: boolean;
  parentImageId: string | null;
  reactions: Record<string, number>;
  isFollowing: boolean;
  /** Only present when `showDetails` is on or the viewer owns the image. */
  details: { prompt: string; negativePrompt: string; seed: number; provider: string | null; model: string | null } | null;
};

export async function toImageDetail(g: ImageWithRelations, user: SafeUser | null): Promise<ImageDetail> {
  const viewerId = user?.id ?? null;
  const [marks, reactions, following, dims] = await Promise.all([viewerContentMarks(viewerId, "image", [g.id]), reactionBreakdown("image", g.id), isFollowing(viewerId, g.ownerId), mediaDims([g.mediaId])]);
  const owner = isOwnerOrMod({ ownerId: g.ownerId }, user);
  const showDetails = owner || g.showDetails;
  return {
    ...toImageCard(g, viewerId, marks, dims),
    showDetails: g.showDetails,
    allowRemix: g.allowRemix,
    parentImageId: g.parentImageId,
    reactions,
    isFollowing: following,
    details: showDetails ? { prompt: decryptPrompt(g.promptEnc), negativePrompt: decryptPrompt(g.negativeEnc), seed: g.seed, provider: g.provider, model: g.model } : null,
  };
}

export async function requireOwnedImage(id: string, user: SafeUser): Promise<GeneratedImage> {
  const g = await prisma.generatedImage.findUnique({ where: { id } });
  if (!g || g.ownerId !== user.id) throw new ApiError(404, "Image not found");
  return g;
}

export function imageSearchWhere(q: string | undefined): Prisma.GeneratedImageWhereInput | undefined {
  if (!q) return undefined;
  const s = q.trim().slice(0, 80);
  if (!s) return undefined;
  return { OR: [{ title: { contains: s } }, { tags: { contains: s } }, { character: { name: { contains: s } } }] };
}
