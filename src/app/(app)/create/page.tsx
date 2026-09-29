import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cardInclude, toCard } from "@/lib/characters";
import { statsForMany } from "@/lib/character-write";
import { Button, SectionTitle } from "@/components/ui";
import { MyCharacters } from "@/components/create/my-characters";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const user = (await getCurrentUser())!;
  const rows = await prisma.character.findMany({ where: { ownerId: user.id }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], include: cardInclude });
  const stats = await statsForMany(rows);
  const items = rows.map((r) => ({ card: toCard(r, { id: user.id }), stats: stats[r.id], updatedAt: r.updatedAt.toISOString() }));
  return (
    <div className="space-y-4">
      <SectionTitle
        title="Create"
        subtitle={`${items.length} character${items.length === 1 ? "" : "s"}`}
        action={
          <Button href="/create/new" size="sm">
            <Plus className="h-4 w-4" /> New character
          </Button>
        }
      />
      <MyCharacters items={items} />
    </div>
  );
}
