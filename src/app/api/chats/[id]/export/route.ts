import { prisma } from "@/lib/db";
import { json, route } from "@/lib/api";
import { loadChat, toMessageDto } from "@/lib/chat";

/** Plain export of a chat (owner only). Used by story/comic "from chat" flows and data export. */
export const GET = route<{ id: string }>({ policy: "read" }, async ({ user, params, req }) => {
  const chat = await loadChat(params.id, user!.id);
  const messages = await prisma.message.findMany({ where: { chatId: chat.id }, orderBy: { createdAt: "asc" } });
  const body = { id: chat.id, title: chat.title, character: { id: chat.character.id, name: chat.character.name }, createdAt: chat.createdAt, messages: messages.map(toMessageDto).map(({ role, content, createdAt }) => ({ role, content, createdAt })) };
  if (req.nextUrl.searchParams.get("download") === "1") {
    return new Response(JSON.stringify(body, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="chat-${chat.id}.json"` } });
  }
  return json(body);
});
