import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { pickableCharacters, prefsOf } from "@/lib/content";
import { decryptPrompt } from "@/lib/images";
import { ImageGenerator, type RemixSeed } from "@/components/gallery/image-generator";

export const metadata: Metadata = { title: "Generate image" };

export default async function NewImagePage({ searchParams }: PageProps<"/gallery/new">) {
  const user = (await getCurrentUser())!;
  const sp = await searchParams;
  const prefs = prefsOf(user);
  const characters = await pickableCharacters(user.id);
  let remix: RemixSeed | null = null;
  if (typeof sp.remix === "string") {
    const p = await prisma.generatedImage.findUnique({ where: { id: sp.remix } });
    const own = p?.ownerId === user.id;
    if (p && (own || (p.allowRemix && p.visibility === "PUBLIC" && p.status === "PUBLISHED" && p.modStatus === "ACTIVE"))) {
      remix = { id: p.id, prompt: decryptPrompt(p.promptEnc), negativePrompt: decryptPrompt(p.negativeEnc), style: p.style, seed: p.seed, orientation: p.orientation, characterId: p.characterId, intensity: p.intensity };
    }
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl">{remix ? "Remix an image" : "Generate an image"}</h1>
        <p className="text-xs text-muted">Every result is a private draft until you publish it.</p>
      </div>
      <ImageGenerator characters={characters} maxIntensity={prefs.maxIntensity} displayName={user.displayName} remix={remix} />
    </div>
  );
}
