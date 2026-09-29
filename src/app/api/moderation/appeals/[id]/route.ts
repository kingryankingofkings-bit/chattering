import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { isModerator } from "@/lib/auth";
import { setTargetStatus } from "@/lib/moderation";
import type { TargetType } from "@/lib/constants";

export const POST = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  if (!isModerator(user)) throw new ApiError(403, "Moderators only");
  const body = await parseBody(req, z.object({ decision: z.enum(["ACCEPTED", "REJECTED"]), response: z.string().max(1000).optional() }));
  const appeal = await prisma.appeal.findUnique({ where: { id: params.id } });
  if (!appeal || appeal.status !== "OPEN") throw new ApiError(404, "Appeal not found or already decided");
  if (body.decision === "ACCEPTED") {
    await setTargetStatus(appeal.targetType as TargetType, appeal.targetId, "RESTORE");
    await prisma.moderationAction.create({ data: { moderatorId: user!.id, targetType: appeal.targetType, targetId: appeal.targetId, action: "RESTORE", note: `Appeal accepted: ${body.response ?? ""}`.trim() } });
  }
  await prisma.appeal.update({ where: { id: appeal.id }, data: { status: body.decision, response: body.response } });
  return json({ ok: true });
});
