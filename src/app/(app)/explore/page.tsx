import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { decryptJson } from "@/lib/crypto";
import { recommendedStrip } from "@/lib/explore";
import { defaultPrefs, type UserPrefs } from "@/lib/types";
import { CharacterCardSkeleton } from "@/components/character/character-card";
import { ExploreFeed } from "@/components/explore/explore-feed";
import { RecommendedStrip } from "@/components/explore/recommended-strip";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Explore" };

export default async function ExplorePage() {
  const user = await getCurrentUser();
  const prefs = decryptJson<UserPrefs>(user?.prefsEnc, defaultPrefs());
  const strip = await recommendedStrip(user?.id ?? null, prefs).catch(() => null);
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl">Explore</h1>
          <p className="text-xs text-muted">Find someone worth staying up for.</p>
        </div>
      </header>
      {strip && <RecommendedStrip title={strip.title} subtitle={strip.subtitle} items={strip.items} blur={prefs.blurNsfw} />}
      <section aria-label="All characters">
        <Suspense fallback={<ExploreFallback />}>
          <ExploreFeed blur={prefs.blurNsfw} maxIntensity={prefs.maxIntensity} />
        </Suspense>
      </section>
    </div>
  );
}

function ExploreFallback() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-8 w-2/3" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CharacterCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
