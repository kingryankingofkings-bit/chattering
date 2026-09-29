import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { encryptString } from "@/lib/crypto";
import { REPORT_REASONS, TARGET_TYPES } from "@/lib/constants";

const schema = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().min(1).max(64),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(1000).optional().default(""),
});

export const POST = route({ policy: "report" }, async ({ req, user }) => {
  const body = await parseBody(req, schema);
  const dup = await prisma.report.findFirst({ where: { reporterId: user!.id, targetType: body.targetType, targetId: body.targetId, status: { in: ["OPEN", "REVIEWING"] } } });
  if (dup) throw new ApiError(409, "You already reported this. A moderator will review it.");
  const report = await prisma.report.create({
    data: { reporterId: user!.id, targetType: body.targetType, targetId: body.targetId, reason: body.reason, detailsEnc: body.details ? encryptString(body.details) : null },
  });
  // Auto-hide on the most serious categories once two independent reports agree.
  const severe = ["underage or minor-coded content", "real person / deepfake", "bestiality", "incest"];
  if (severe.includes(body.reason)) {
    const n = await prisma.report.count({ where: { targetType: body.targetType, targetId: body.targetId, reason: body.reason, status: { in: ["OPEN", "REVIEWING"] } } });
    if (n >= 2) {
      if (body.targetType === "CHARACTER") await prisma.character.updateMany({ where: { id: body.targetId, status: "ACTIVE" }, data: { status: "HIDDEN" } });
      if (body.targetType === "COMIC") await prisma.comic.updateMany({ where: { id: body.targetId, modStatus: "ACTIVE" }, data: { modStatus: "HIDDEN" } });
      if (body.targetType === "STORY") await prisma.story.updateMany({ where: { id: body.targetId, modStatus: "ACTIVE" }, data: { modStatus: "HIDDEN" } });
      if (body.targetType === "IMAGE") await prisma.generatedImage.updateMany({ where: { id: body.targetId, modStatus: "ACTIVE" }, data: { modStatus: "HIDDEN" } });
    }
  }
  return json({ ok: true, id: report.id });
});
