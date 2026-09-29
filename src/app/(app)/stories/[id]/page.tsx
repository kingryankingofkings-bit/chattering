import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { bumpViewCount, contentAccess, prefsOf } from "@/lib/content";
import { storyInclude, toStoryDetail } from "@/lib/stories";
import { StoryReader } from "@/components/stories/story-reader";
import { UnderReview } from "@/components/content/status";

async function load(id: string) {
  const user = await getCurrentUser();
  const story = await prisma.story.findUnique({ where: { id }, include: storyInclude });
  if (!story) return { user, story: null, access: "notfound" as const };
  const access = contentAccess({ ownerId: story.authorId, visibility: story.visibility, status: story.status, modStatus: story.modStatus }, user);
  return { user, story, access };
}

export async function generateMetadata({ params }: PageProps<"/stories/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { story, access } = await load(id);
  if (!story || access !== "ok") return { title: "Story" };
  return { title: `${story.title} · Stories`, description: story.summary.slice(0, 160) };
}

export default async function StoryPage({ params }: PageProps<"/stories/[id]">) {
  const { id } = await params;
  const { user, story, access } = await load(id);
  if (!story || access === "notfound") notFound();
  if (access === "review") return <UnderReview backHref="/stories" label="story" />;
  const prefs = prefsOf(user);
  const detail = await toStoryDetail(story, user);
  if (!detail.isOwner) bumpViewCount("story", story.id);
  return <StoryReader initial={detail} viewer={{ id: user!.id, displayName: user!.displayName, maxIntensity: prefs.maxIntensity }} />;
}
