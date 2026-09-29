import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { characterStats, toFull } from "@/lib/character-write";
import { CharacterEditor } from "@/components/create/character-editor";

export const dynamic = "force-dynamic";

export default async function EditCharacterPage({ params }: PageProps<"/create/[id]">) {
  const { id } = await params;
  const user = (await getCurrentUser())!;
  const c = await prisma.character.findUnique({ where: { id } });
  if (!c || c.ownerId !== user.id) notFound();
  const stats = await characterStats(c);
  return <CharacterEditor key={c.id} initial={toFull(c)} initialStats={stats} />;
}
