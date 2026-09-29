import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prefsOf } from "@/lib/content";
import { StoryBrowse } from "@/components/stories/story-browse";

export const metadata: Metadata = { title: "Stories" };

export default async function StoriesPage() {
  const user = await getCurrentUser();
  const prefs = prefsOf(user);
  return <StoryBrowse maxIntensity={prefs.maxIntensity} />;
}
