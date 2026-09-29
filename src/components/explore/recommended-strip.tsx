import { Sparkles } from "lucide-react";
import { CharacterCard } from "@/components/character/character-card";
import { SectionTitle } from "@/components/ui";
import type { CharacterCard as Card } from "@/lib/characters";

/** Horizontal strip above the main feed: "Recommended for you" or "Popular right now". */
export function RecommendedStrip({ title, subtitle, items, blur }: { title: string; subtitle?: string; items: Card[]; blur: boolean }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title} className="fade-up">
      <SectionTitle title={title} subtitle={subtitle} action={<Sparkles className="h-4 w-4 text-gold" aria-hidden />} />
      <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {items.map((c) => (
          <div key={c.id} className="w-[42%] shrink-0 snap-start sm:w-[30%] md:w-[23%]">
            <CharacterCard c={c} blur={blur} compactMode />
          </div>
        ))}
      </div>
    </section>
  );
}
