import { prisma } from "@/lib/db";
import { json, route } from "@/lib/api";

/** DELETE /api/me/pinned/[characterId] → { ok } and compacts positions. */
export const DELETE = route<{ characterId: string }>({ policy: "write" }, async ({ user, params }) => {
  await prisma.pinnedCharacter.deleteMany({ where: { userId: user!.id, characterId: params.characterId } });
  const rows = await prisma.pinnedCharacter.findMany({ where: { userId: user!.id }, orderBy: { position: "asc" } });
  await prisma.$transaction(rows.map((r, i) => prisma.pinnedCharacter.update({ where: { userId_characterId: { userId: user!.id, characterId: r.characterId } }, data: { position: i } })));
  return json({ ok: true });
});
