import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { encryptString } from "@/lib/crypto";
import { buildModelRequest, loadChat, maybeSummarize, prefsOf, toMessageDto } from "@/lib/chat";
import { checkText } from "@/lib/safety";
import { getTextProvider } from "@/lib/ai";

const schema = z.object({ content: z.string().trim().min(1).max(4000), clientId: z.string().max(64).optional(), stream: z.boolean().optional().default(true) });

/**
 * Send a user message and get the character's reply.
 * Streaming responses are NDJSON lines:
 *   {"type":"user","message":{...}}  {"type":"delta","text":"..."}  {"type":"done","message":{...}}  {"type":"error","error":"..."}
 */
export const POST = route<{ id: string }>({ policy: "chat" }, async ({ req, user, params }) => {
  const body = await parseBody(req, schema);
  const chat = await loadChat(params.id, user!.id);
  if (chat.character.status === "REMOVED") throw new ApiError(410, "This character was removed");

  const safety = checkText(body.content);
  if (!safety.ok) throw new ApiError(422, safety.reason, { category: safety.category, blocked: true });

  // Idempotent replay from the offline outbox.
  if (body.clientId) {
    const dup = await prisma.message.findUnique({ where: { chatId_clientId: { chatId: chat.id, clientId: body.clientId } } });
    if (dup) {
      const reply = await prisma.message.findFirst({ where: { chatId: chat.id, role: "assistant", createdAt: { gt: dup.createdAt } }, orderBy: { createdAt: "asc" } });
      return json({ user: toMessageDto(dup), assistant: reply ? toMessageDto(reply) : null, duplicate: true }, { status: 409 });
    }
  }

  const userMsg = await prisma.message.create({ data: { chatId: chat.id, role: "user", contentEnc: encryptString(body.content), clientId: body.clientId ?? null } });
  await prisma.chat.update({ where: { id: chat.id }, data: { messageCount: { increment: 1 }, lastMessageAt: new Date() } });

  const prefs = prefsOf(user!.prefsEnc);
  const history = await prisma.message.findMany({ where: { chatId: chat.id }, orderBy: { createdAt: "asc" } });
  const request = await buildModelRequest(chat, prefs, history);
  const provider = getTextProvider();
  const started = Date.now();

  const finalize = async (text: string, usage: { promptTokens: number; completionTokens: number }, model: string) => {
    const cleaned = text.trim() || "*(a long, thoughtful silence)*";
    const assistant = await prisma.message.create({ data: { chatId: chat.id, role: "assistant", contentEnc: encryptString(cleaned), provider: provider.name, model } });
    const updatedChat = await prisma.chat.update({ where: { id: chat.id }, data: { messageCount: { increment: 1 }, lastMessageAt: new Date() } });
    await prisma.generation.create({ data: { userId: user!.id, kind: chat.isPreview ? "PREVIEW" : "CHAT", provider: provider.name, model, promptTokens: usage.promptTokens, completionTokens: usage.completionTokens, durationMs: Date.now() - started, status: "OK" } });
    if (!chat.isPreview) await prisma.character.update({ where: { id: chat.characterId }, data: { messageCount: { increment: 2 } } }).catch(() => {});
    void maybeSummarize(updatedChat, user!.id);
    return assistant;
  };

  if (!body.stream) {
    try {
      const out = await provider.complete({ ...request, signal: req.signal });
      const assistant = await finalize(out.text, out.usage, out.model);
      return json({ user: toMessageDto(userMsg), assistant: toMessageDto(assistant) });
    } catch (err) {
      await prisma.generation.create({ data: { userId: user!.id, kind: "CHAT", provider: provider.name, model: provider.model, durationMs: Date.now() - started, status: "ERROR", error: String(err).slice(0, 300) } });
      throw new ApiError(502, "The character couldn't answer right now. Try again.");
    }
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      send({ type: "user", message: toMessageDto(userMsg) });
      let full = "";
      try {
        const gen = provider.stream({ ...request, signal: req.signal });
        let result = await gen.next();
        while (!result.done) {
          full += result.value;
          send({ type: "delta", text: result.value });
          result = await gen.next();
        }
        const assistant = await finalize(full || result.value.text, result.value.usage, result.value.model);
        send({ type: "done", message: toMessageDto(assistant) });
      } catch (err) {
        if (full.trim()) {
          const assistant = await finalize(full, { promptTokens: 0, completionTokens: 0 }, provider.model);
          send({ type: "done", message: toMessageDto(assistant) });
        } else {
          await prisma.generation.create({ data: { userId: user!.id, kind: "CHAT", provider: provider.name, model: provider.model, durationMs: Date.now() - started, status: "ERROR", error: String(err).slice(0, 300) } });
          send({ type: "error", error: "The character couldn't answer right now. Try again." });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
});
