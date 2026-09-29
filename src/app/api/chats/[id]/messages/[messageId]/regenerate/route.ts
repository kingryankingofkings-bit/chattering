import { prisma } from "@/lib/db";
import { ApiError, json, route } from "@/lib/api";
import { encryptString } from "@/lib/crypto";
import { buildModelRequest, loadChat, prefsOf, toMessageDto } from "@/lib/chat";
import { getTextProvider } from "@/lib/ai";

/** Replace an assistant message with a fresh generation from the same point in the conversation. */
export const POST = route<{ id: string; messageId: string }>({ policy: "chat" }, async ({ user, params, req }) => {
  const chat = await loadChat(params.id, user!.id);
  const target = await prisma.message.findFirst({ where: { id: params.messageId, chatId: chat.id, role: "assistant" } });
  if (!target) throw new ApiError(404, "Message not found");
  const history = await prisma.message.findMany({ where: { chatId: chat.id, createdAt: { lt: target.createdAt } }, orderBy: { createdAt: "asc" } });
  const request = await buildModelRequest(chat, prefsOf(user!.prefsEnc), history);
  request.meta = { ...request.meta, kind: "chat", seed: Date.now() % 100000 };
  request.temperature = 1.0;
  const provider = getTextProvider();
  const started = Date.now();
  try {
    const out = await provider.complete({ ...request, signal: req.signal });
    const updated = await prisma.message.update({ where: { id: target.id }, data: { contentEnc: encryptString(out.text.trim() || "*(silence)*"), provider: provider.name, model: out.model } });
    await prisma.generation.create({ data: { userId: user!.id, kind: "CHAT", provider: provider.name, model: out.model, promptTokens: out.usage.promptTokens, completionTokens: out.usage.completionTokens, durationMs: Date.now() - started, status: "OK" } });
    return json({ message: toMessageDto(updated) });
  } catch (err) {
    await prisma.generation.create({ data: { userId: user!.id, kind: "CHAT", provider: provider.name, model: provider.model, durationMs: Date.now() - started, status: "ERROR", error: String(err).slice(0, 300) } });
    throw new ApiError(502, "Couldn't regenerate right now. Try again.");
  }
});
