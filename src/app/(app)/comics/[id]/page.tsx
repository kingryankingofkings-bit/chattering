import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { bumpViewCount, contentAccess, prefsOf } from "@/lib/content";
import { comicInclude, toComicDetail } from "@/lib/comics";
import { ComicReader } from "@/components/comics/comic-reader";
import { UnderReview } from "@/components/content/status";

async function load(id: string) {
  const user = await getCurrentUser();
  const comic = await prisma.comic.findUnique({ where: { id }, include: comicInclude });
  if (!comic) return { user, comic: null, access: "notfound" as const };
  const access = contentAccess({ ownerId: comic.authorId, visibility: comic.visibility, status: comic.status, modStatus: comic.modStatus }, user);
  return { user, comic, access };
}

export async function generateMetadata({ params }: PageProps<"/comics/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { comic, access } = await load(id);
  if (!comic || access !== "ok") return { title: "Comic" };
  return { title: `${comic.title} · Comics`, description: comic.premise.slice(0, 160), openGraph: comic.visibility === "PUBLIC" && comic.coverMediaId ? { images: [`/api/media/${comic.coverMediaId}`] } : undefined };
}

export default async function ComicPage({ params }: PageProps<"/comics/[id]">) {
  const { id } = await params;
  const { user, comic, access } = await load(id);
  if (!comic || access === "notfound") notFound();
  if (access === "review") return <UnderReview backHref="/comics" label="comic" />;
  const prefs = prefsOf(user);
  const detail = await toComicDetail(comic, user);
  if (!detail.isOwner) bumpViewCount("comic", comic.id);
  return <ComicReader initial={detail} viewer={{ id: user!.id, displayName: user!.displayName, blur: prefs.blurNsfw, maxIntensity: prefs.maxIntensity }} />;
}
