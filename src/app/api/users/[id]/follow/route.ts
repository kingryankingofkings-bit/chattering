import { prisma } from "@/lib/db";
import { ApiError, json, route } from "@/lib/api";
import { decryptJson } from "@/lib/crypto";
import { defaultPrefs, type UserPrefs } from "@/lib/types";

export const POST = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  if (params.id === user!.id) throw new ApiError(400, "You can't follow yourself");
  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, prefsEnc: true, deletedAt: true } });
  if (!target || target.deletedAt) throw new ApiError(404, "Creator not found");
  const prefs = decryptJson<UserPrefs>(target.prefsEnc, defaultPrefs());
  if (!prefs.allowFollows) throw new ApiError(403, "This creator isn't accepting follows");
  const blocked = await prisma.block.findUnique({ where: { userId_blockedUserId: { userId: params.id, blockedUserId: user!.id } } });
  if (blocked) throw new ApiError(403, "You can't follow this creator");
  await prisma.follow.upsert({ where: { followerId_creatorId: { followerId: user!.id, creatorId: params.id } }, create: { followerId: user!.id, creatorId: params.id }, update: {} });
  return json({ ok: true, following: true });
});

export const DELETE = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  await prisma.follow.deleteMany({ where: { followerId: user!.id, creatorId: params.id } });
  return json({ ok: true, following: false });
});
