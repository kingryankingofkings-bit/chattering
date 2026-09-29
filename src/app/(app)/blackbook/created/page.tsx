import { PenSquare, Plus } from "lucide-react";
import { BlackbookPage } from "@/components/blackbook/page-shell";
import { MyCharacters } from "@/components/create/my-characters";
import { Button } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cardInclude, toCard } from "@/lib/characters";
import { statsForMany } from "@/lib/character-write";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = (await getCurrentUser())!;
  const rows = await prisma.character.findMany({ where: { ownerId: user.id }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], include: cardInclude });
  const stats = await statsForMany(rows);
  const items = rows.map((r) => ({ card: toCard(r, { id: user.id }), stats: stats[r.id], updatedAt: r.updatedAt.toISOString() }));
  return (
    <BlackbookPage
      title="Created characters"
      subtitle={`${items.length} character${items.length === 1 ? "" : "s"}`}
      action={
        <div className="flex gap-2">
          <Button href="/create" variant="secondary" size="sm"><PenSquare className="h-3.5 w-3.5" /> Studio</Button>
          <Button href="/create/new" size="sm"><Plus className="h-3.5 w-3.5" /> New</Button>
        </div>
      }
    >
      <MyCharacters items={items} />
    </BlackbookPage>
  );
}
