import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { bumpViewCount, contentAccess, prefsOf } from "@/lib/content";
import { imageInclude, toImageDetail } from "@/lib/images";
import { ImageViewer } from "@/components/gallery/image-viewer";
import { UnderReview } from "@/components/content/status";

async function load(id: string) {
  const user = await getCurrentUser();
  const img = await prisma.generatedImage.findUnique({ where: { id }, include: imageInclude });
  if (!img) return { user, img: null, access: "notfound" as const };
  const access = contentAccess({ ownerId: img.ownerId, visibility: img.visibility, status: img.status, modStatus: img.modStatus }, user);
  return { user, img, access };
}

export async function generateMetadata({ params }: PageProps<"/gallery/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { img, access } = await load(id);
  if (!img || access !== "ok") return { title: "Image" };
  return { title: `${img.title || "Untitled"} · Gallery`, description: `${img.style} image by ${img.owner.displayName}`, openGraph: img.visibility === "PUBLIC" ? { images: [`/api/media/${img.mediaId}`] } : undefined };
}

export default async function ImagePage({ params }: PageProps<"/gallery/[id]">) {
  const { id } = await params;
  const { user, img, access } = await load(id);
  if (!img || access === "notfound") notFound();
  if (access === "review") return <UnderReview backHref="/gallery" label="image" />;
  const prefs = prefsOf(user);
  const detail = await toImageDetail(img, user);
  if (!detail.isOwner) bumpViewCount("image", img.id);
  return <ImageViewer initial={detail} viewer={{ id: user!.id, displayName: user!.displayName, blur: prefs.blurNsfw, maxIntensity: prefs.maxIntensity }} />;
}
