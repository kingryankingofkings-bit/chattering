import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, parseBody, route } from "@/lib/api";
import { loadChat, toChatDto, toMessageDto } from "@/lib/chat";
import { checkText } from "@/lib/safety";
import { ApiError } from "@/lib/api";

export const GET = route<{ id: string }>({ policy: "read" }, async ({ user, params }) => {
  const chat = await loadChat(params.id, user!.id);
  const [messages, personas] = await Promise.all([
    prisma.message.findMany({ where: { chatId: chat.id }, orderBy: { createdAt: "asc" } }),
    prisma.persona.findMany({ where: { userId: user!.id }, select: { id: true, name: true, isDefault: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return json({ chat: toChatDto(chat, user!.id), messages: messages.map(toMessageDto), personas });
});

export const PUT = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const chat = await loadChat(params.id, user!.id);
  const body = await parseBody(req, z.object({ title: z.string().trim().min(1).max(80).optional(), personaId: z.string().nullable().optional(), archived: z.boolean().optional(), clear: z.boolean().optional() }));
  if (body.title) {
    const s = checkText(body.title);
    if (!s.ok) throw new ApiError(422, s.reason, { category: s.category });
  }
  if (body.personaId) {
    const p = await prisma.persona.findFirst({ where: { id: body.personaId, userId: user!.id } });
    if (!p) throw new ApiError(404, "Persona not found");
  }
  if (body.clear) {
    await prisma.message.deleteMany({ where: { chatId: chat.id } });
    await prisma.chat.update({ where: { id: chat.id }, data: { messageCount: 0, summaryEnc: null } });
  }
  const updated = await prisma.chat.update({
    where: { id: chat.id },
    data: { ...(body.title ? { title: body.title } : {}), ...(body.personaId !== undefined ? { personaId: body.personaId } : {}), ...(body.archived !== undefined ? { archived: body.archived } : {}) },
    include: { character: { include: { owner: { select: { id: true, displayName: true } } } } },
  });
  return json({ chat: toChatDto(updated, user!.id) });
});

export const DELETE = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  const chat = await loadChat(params.id, user!.id);
  await prisma.chat.delete({ where: { id: chat.id } });
  return json({ ok: true });
});
