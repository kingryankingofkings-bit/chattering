import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { pickableCharacters, prefsOf, recentChats } from "@/lib/content";
import { StoryGenerator } from "@/components/stories/story-generator";

export const metadata: Metadata = { title: "New story" };

export default async function NewStoryPage({ searchParams }: PageProps<"/stories/new">) {
  const user = (await getCurrentUser())!;
  const sp = await searchParams;
  const prefs = prefsOf(user);
  const [characters, chats] = await Promise.all([pickableCharacters(user.id), recentChats(user.id)]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl">Write a story</h1>
        <p className="text-xs text-muted">Featured characters keep their look, voice and memories of you.</p>
      </div>
      <StoryGenerator characters={characters} chats={chats} maxIntensity={prefs.maxIntensity} initialCharacterId={typeof sp.characterId === "string" ? sp.characterId : undefined} initialChatId={typeof sp.chatId === "string" ? sp.chatId : undefined} />
    </div>
  );
}
