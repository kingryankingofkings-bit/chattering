import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, pagination, parseQuery, route } from "@/lib/api";
import { isModerator } from "@/lib/auth";
import { decryptString } from "@/lib/crypto";
import { summarizeTarget } from "@/lib/moderation";
import type { TargetType } from "@/lib/constants";

export const GET = route({ policy: "read" }, async ({ req, user }) => {
  if (!isModerator(user)) throw new ApiError(403, "Moderators only");
  const q = parseQuery(req, pagination.extend({ status: z.enum(["OPEN", "ACCEPTED", "REJECTED", "ALL"]).default("OPEN") }));
  const appeals = await prisma.appeal.findMany({
    where: q.status === "ALL" ? {} : { status: q.status },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    include: { user: { select: { id: true, displayName: true } }, action: true },
  });
  const hasMore = appeals.length > q.limit;
  const items = await Promise.all(
    appeals.slice(0, q.limit).map(async (a) => ({
      id: a.id,
      targetType: a.targetType,
      targetId: a.targetId,
      message: decryptString(a.messageEnc),
      status: a.status,
      response: a.response,
      createdAt: a.createdAt.toISOString(),
      user: a.user,
      action: a.action ? { action: a.action.action, note: a.action.note, createdAt: a.action.createdAt.toISOString() } : null,
      target: await summarizeTarget(a.targetType as TargetType, a.targetId),
    })),
  );
  return json({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
});
