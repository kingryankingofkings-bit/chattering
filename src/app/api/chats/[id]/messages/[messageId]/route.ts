import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { encryptString } from "@/lib/crypto";
import { loadChat, toMessageDto } from "@/lib/chat";
import { checkText } from "@/lib/safety";

export const DELETE = route<{ id: string; messageId: string }>({ policy: "write" }, async ({ user, params }) => {
  const chat = await loadChat(params.id, user!.id);
  const msg = await prisma.message.findFirst({ where: { id: params.messageId, chatId: chat.id } });
  if (!msg) throw new ApiError(404, "Message not found");
  await prisma.$transaction([prisma.message.delete({ where: { id: msg.id } }), prisma.chat.update({ where: { id: chat.id }, data: { messageCount: { decrement: 1 } } })]);
  return json({ ok: true });
});

export const PUT = route<{ id: string; messageId: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const chat = await loadChat(params.id, user!.id);
  const { content } = await parseBody(req, z.object({ content: z.string().trim().min(1).max(4000) }));
  const s = checkText(content);
  if (!s.ok) throw new ApiError(422, s.reason, { category: s.category, blocked: true });
  const msg = await prisma.message.findFirst({ where: { id: params.messageId, chatId: chat.id } });
  if (!msg) throw new ApiError(404, "Message not found");
  const updated = await prisma.message.update({ where: { id: msg.id }, data: { contentEnc: encryptString(content) } });
  return json({ message: toMessageDto(updated) });
});
