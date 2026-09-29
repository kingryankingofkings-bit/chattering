import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { pickableCharacters, prefsOf } from "@/lib/content";
import { GalleryFeed } from "@/components/gallery/gallery-feed";

export const metadata: Metadata = { title: "Gallery" };

const VIEWS = ["public", "mine", "favorites", "collections", "drafts", "published"] as const;

export default async function GalleryPage({ searchParams }: PageProps<"/gallery">) {
  const user = (await getCurrentUser())!;
  const sp = await searchParams;
  const prefs = prefsOf(user);
  const characters = await pickableCharacters(user.id, 60);
  const v = typeof sp.view === "string" && (VIEWS as readonly string[]).includes(sp.view) ? (sp.view as (typeof VIEWS)[number]) : undefined;
  return <GalleryFeed blur={prefs.blurNsfw} maxIntensity={prefs.maxIntensity} characters={characters} initialView={v} />;
}
