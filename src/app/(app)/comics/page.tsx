import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prefsOf } from "@/lib/content";
import { ComicBrowse } from "@/components/comics/comic-browse";

export const metadata: Metadata = { title: "Comics" };

export default async function ComicsPage() {
  const user = await getCurrentUser();
  const prefs = prefsOf(user);
  return <ComicBrowse blur={prefs.blurNsfw} maxIntensity={prefs.maxIntensity} />;
}
