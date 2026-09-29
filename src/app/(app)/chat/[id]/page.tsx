import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { cardInclude, getSheet } from "@/lib/characters";
import { prefsOf, toChatDto, toMessageDto } from "@/lib/chat";
import { ChatScreen } from "@/components/chat/chat-screen";

export async function generateMetadata({ params }: PageProps<"/chat/[id]">): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  const chat = user ? await prisma.chat.findFirst({ where: { id, userId: user.id }, select: { title: true } }) : null;
  return { title: chat?.title ?? "Chat" };
}

export default async function ChatPage({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const chat = await prisma.chat.findFirst({ where: { id, userId: user.id }, include: { character: { include: cardInclude }, persona: true } });
  if (!chat) notFound();
  const [messages, personas] = await Promise.all([
    prisma.message.findMany({ where: { chatId: chat.id }, orderBy: { createdAt: "asc" } }),
    prisma.persona.findMany({ where: { userId: user.id }, select: { id: true, name: true, isDefault: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const sheet = getSheet(chat.character);
  const prefs = prefsOf(user.prefsEnc);
  return <ChatScreen chat={toChatDto(chat, user.id)} messages={messages.map(toMessageDto)} personas={personas} boundaries={sheet.boundaries} hardLimits={prefs.hardLimits} />;
}
