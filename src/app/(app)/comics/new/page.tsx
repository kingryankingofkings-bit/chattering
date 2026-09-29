import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { pickableCharacters, prefsOf, recentChats } from "@/lib/content";
import { ComicGenerator } from "@/components/comics/comic-generator";

export const metadata: Metadata = { title: "New comic" };

export default async function NewComicPage({ searchParams }: PageProps<"/comics/new">) {
  const user = (await getCurrentUser())!;
  const sp = await searchParams;
  const prefs = prefsOf(user);
  const [characters, chats] = await Promise.all([pickableCharacters(user.id), recentChats(user.id)]);
  const characterId = typeof sp.characterId === "string" ? sp.characterId : undefined;
  const chatId = typeof sp.chatId === "string" ? sp.chatId : undefined;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl">Create a comic</h1>
        <p className="text-xs text-muted">A script is written first, then every panel is drawn with a consistent character look.</p>
      </div>
      <ComicGenerator characters={characters} chats={chats} maxIntensity={prefs.maxIntensity} initialCharacterId={characterId} initialChatId={chatId} />
    </div>
  );
}
