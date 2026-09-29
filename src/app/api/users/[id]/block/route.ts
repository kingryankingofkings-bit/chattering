import { prisma } from "@/lib/db";
import { ApiError, json, route } from "@/lib/api";

export const POST = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  if (params.id === user!.id) throw new ApiError(400, "You can't block yourself");
  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!target) throw new ApiError(404, "User not found");
  await prisma.$transaction([
    prisma.block.upsert({ where: { userId_blockedUserId: { userId: user!.id, blockedUserId: params.id } }, create: { userId: user!.id, blockedUserId: params.id }, update: {} }),
    prisma.follow.deleteMany({ where: { followerId: user!.id, creatorId: params.id } }),
  ]);
  return json({ ok: true, blocked: true });
});

export const DELETE = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  await prisma.block.deleteMany({ where: { userId: user!.id, blockedUserId: params.id } });
  return json({ ok: true, blocked: false });
});
