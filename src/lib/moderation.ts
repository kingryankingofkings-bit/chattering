import "server-only";
import { prisma } from "./db";
import { decryptString } from "./crypto";
import type { TargetType } from "./constants";

export type ModAction = "HIDE" | "REMOVE" | "RESTORE" | "DISMISS" | "WARN";

const STATUS_FOR: Record<ModAction, string | null> = { HIDE: "HIDDEN", REMOVE: "REMOVED", RESTORE: "ACTIVE", DISMISS: null, WARN: null };

/** Apply a moderation status change to any moderated target type. */
export async function setTargetStatus(targetType: TargetType, targetId: string, action: ModAction) {
  const status = STATUS_FOR[action];
  if (!status) return;
  switch (targetType) {
    case "CHARACTER":
      await prisma.character.updateMany({ where: { id: targetId }, data: { status } });
      break;
    case "COMIC":
      await prisma.comic.updateMany({ where: { id: targetId }, data: { modStatus: status } });
      break;
    case "STORY":
      await prisma.story.updateMany({ where: { id: targetId }, data: { modStatus: status } });
      break;
    case "IMAGE":
      await prisma.generatedImage.updateMany({ where: { id: targetId }, data: { modStatus: status } });
      break;
    case "USER":
      if (status === "REMOVED") await prisma.user.updateMany({ where: { id: targetId, role: "USER" }, data: { deletedAt: new Date() } });
      if (status === "ACTIVE") await prisma.user.updateMany({ where: { id: targetId }, data: { deletedAt: null } });
      break;
    case "CHAT_MESSAGE":
      if (status === "REMOVED") await prisma.message.deleteMany({ where: { id: targetId } });
      break;
  }
}

export type TargetSummary = { title: string; subtitle: string; ownerId: string | null; ownerName: string | null; status: string | null; href: string | null };

export async function summarizeTarget(targetType: TargetType, targetId: string): Promise<TargetSummary> {
  const none: TargetSummary = { title: "(deleted)", subtitle: "", ownerId: null, ownerName: null, status: null, href: null };
  switch (targetType) {
    case "CHARACTER": {
      const c = await prisma.character.findUnique({ where: { id: targetId }, include: { owner: { select: { id: true, displayName: true } } } });
      return c ? { title: c.name, subtitle: c.tagline, ownerId: c.owner.id, ownerName: c.owner.displayName, status: c.status, href: `/character/${c.id}` } : none;
    }
    case "COMIC": {
      const c = await prisma.comic.findUnique({ where: { id: targetId }, include: { author: { select: { id: true, displayName: true } } } });
      return c ? { title: c.title, subtitle: c.premise, ownerId: c.author.id, ownerName: c.author.displayName, status: c.modStatus, href: `/comics/${c.id}` } : none;
    }
    case "STORY": {
      const s = await prisma.story.findUnique({ where: { id: targetId }, include: { author: { select: { id: true, displayName: true } } } });
      return s ? { title: s.title, subtitle: s.summary, ownerId: s.author.id, ownerName: s.author.displayName, status: s.modStatus, href: `/stories/${s.id}` } : none;
    }
    case "IMAGE": {
      const i = await prisma.generatedImage.findUnique({ where: { id: targetId }, include: { owner: { select: { id: true, displayName: true } } } });
      return i ? { title: i.title || "Untitled image", subtitle: decryptString(i.promptEnc).slice(0, 140), ownerId: i.owner.id, ownerName: i.owner.displayName, status: i.modStatus, href: `/gallery/${i.id}` } : none;
    }
    case "USER": {
      const u = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, displayName: true, deletedAt: true } });
      return u ? { title: u.displayName, subtitle: "User account", ownerId: u.id, ownerName: u.displayName, status: u.deletedAt ? "REMOVED" : "ACTIVE", href: `/creator/${u.id}` } : none;
    }
    case "CHAT_MESSAGE": {
      const m = await prisma.message.findUnique({ where: { id: targetId }, include: { chat: { select: { userId: true, user: { select: { displayName: true } } } } } });
      return m ? { title: "Chat message", subtitle: decryptString(m.contentEnc).slice(0, 200), ownerId: m.chat.userId, ownerName: m.chat.user.displayName, status: "ACTIVE", href: null } : none;
    }
  }
}
