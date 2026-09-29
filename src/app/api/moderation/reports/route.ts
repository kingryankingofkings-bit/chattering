import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, pagination, parseQuery, route } from "@/lib/api";
import { isModerator } from "@/lib/auth";
import { decryptString } from "@/lib/crypto";
import { summarizeTarget } from "@/lib/moderation";
import type { TargetType } from "@/lib/constants";

export const GET = route({ policy: "read" }, async ({ req, user }) => {
  if (!isModerator(user)) throw new ApiError(403, "Moderators only");
  const q = parseQuery(req, pagination.extend({ status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED", "ALL"]).default("OPEN") }));
  const reports = await prisma.report.findMany({
    where: q.status === "ALL" ? {} : { status: q.status },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    include: { reporter: { select: { id: true, displayName: true } } },
  });
  const hasMore = reports.length > q.limit;
  const items = await Promise.all(
    reports.slice(0, q.limit).map(async (r) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      details: r.detailsEnc ? decryptString(r.detailsEnc) : "",
      status: r.status,
      resolution: r.resolution,
      createdAt: r.createdAt.toISOString(),
      reporter: r.reporter,
      target: await summarizeTarget(r.targetType as TargetType, r.targetId),
      similar: await prisma.report.count({ where: { targetType: r.targetType, targetId: r.targetId } }),
    })),
  );
  return json({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
});
