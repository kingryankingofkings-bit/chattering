import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { isModerator } from "@/lib/auth";
import { setTargetStatus, type ModAction } from "@/lib/moderation";
import type { TargetType } from "@/lib/constants";

export const POST = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  if (!isModerator(user)) throw new ApiError(403, "Moderators only");
  const body = await parseBody(req, z.object({ action: z.enum(["HIDE", "REMOVE", "RESTORE", "DISMISS", "WARN"]), note: z.string().max(1000).optional() }));
  const report = await prisma.report.findUnique({ where: { id: params.id } });
  if (!report) throw new ApiError(404, "Report not found");
  await setTargetStatus(report.targetType as TargetType, report.targetId, body.action as ModAction);
  const action = await prisma.moderationAction.create({ data: { moderatorId: user!.id, targetType: report.targetType, targetId: report.targetId, action: body.action, note: body.note } });
  // Resolve every open report on the same target together.
  await prisma.report.updateMany({
    where: { targetType: report.targetType, targetId: report.targetId, status: { in: ["OPEN", "REVIEWING"] } },
    data: { status: body.action === "DISMISS" ? "DISMISSED" : "RESOLVED", resolution: body.action, resolvedById: user!.id },
  });
  return json({ ok: true, actionId: action.id });
});
