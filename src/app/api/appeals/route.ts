import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { decryptString, encryptString } from "@/lib/crypto";
import { TARGET_TYPES, type TargetType } from "@/lib/constants";
import { summarizeTarget } from "@/lib/moderation";
import { checkText } from "@/lib/safety";

/** The signed-in user's own appeals plus their currently moderated content. */
export const GET = route({ policy: "read" }, async ({ user }) => {
  const [appeals, characters, comics, stories, images] = await Promise.all([
    prisma.appeal.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.character.findMany({ where: { ownerId: user!.id, status: { not: "ACTIVE" } }, select: { id: true, name: true, status: true } }),
    prisma.comic.findMany({ where: { authorId: user!.id, modStatus: { not: "ACTIVE" } }, select: { id: true, title: true, modStatus: true } }),
    prisma.story.findMany({ where: { authorId: user!.id, modStatus: { not: "ACTIVE" } }, select: { id: true, title: true, modStatus: true } }),
    prisma.generatedImage.findMany({ where: { ownerId: user!.id, modStatus: { not: "ACTIVE" } }, select: { id: true, title: true, modStatus: true } }),
  ]);
  const moderated = [
    ...characters.map((c) => ({ targetType: "CHARACTER" as const, targetId: c.id, title: c.name, status: c.status })),
    ...comics.map((c) => ({ targetType: "COMIC" as const, targetId: c.id, title: c.title, status: c.modStatus })),
    ...stories.map((s) => ({ targetType: "STORY" as const, targetId: s.id, title: s.title, status: s.modStatus })),
    ...images.map((i) => ({ targetType: "IMAGE" as const, targetId: i.id, title: i.title || "Untitled image", status: i.modStatus })),
  ];
  const actions = await prisma.moderationAction.findMany({ where: { OR: moderated.map((m) => ({ targetType: m.targetType, targetId: m.targetId })) }, orderBy: { createdAt: "desc" } });
  return json({
    moderated: moderated.map((m) => ({ ...m, lastAction: actions.find((a) => a.targetType === m.targetType && a.targetId === m.targetId) ?? null, hasOpenAppeal: appeals.some((a) => a.targetType === m.targetType && a.targetId === m.targetId && a.status === "OPEN") })),
    appeals: await Promise.all(appeals.map(async (a) => ({ id: a.id, targetType: a.targetType, targetId: a.targetId, message: decryptString(a.messageEnc), status: a.status, response: a.response, createdAt: a.createdAt.toISOString(), target: await summarizeTarget(a.targetType as TargetType, a.targetId) }))),
  });
});

export const POST = route({ policy: "report" }, async ({ req, user }) => {
  const body = await parseBody(req, z.object({ targetType: z.enum(TARGET_TYPES), targetId: z.string().min(1), message: z.string().trim().min(10).max(2000) }));
  const s = checkText(body.message);
  if (!s.ok) throw new ApiError(422, s.reason, { category: s.category });
  const target = await summarizeTarget(body.targetType, body.targetId);
  if (!target.ownerId || target.ownerId !== user!.id) throw new ApiError(403, "You can only appeal decisions about your own content");
  const open = await prisma.appeal.findFirst({ where: { userId: user!.id, targetType: body.targetType, targetId: body.targetId, status: "OPEN" } });
  if (open) throw new ApiError(409, "You already have an open appeal for this item");
  const lastAction = await prisma.moderationAction.findFirst({ where: { targetType: body.targetType, targetId: body.targetId }, orderBy: { createdAt: "desc" } });
  const appeal = await prisma.appeal.create({ data: { userId: user!.id, actionId: lastAction?.id ?? null, targetType: body.targetType, targetId: body.targetId, messageEnc: encryptString(body.message) } });
  return json({ ok: true, id: appeal.id });
});
