import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { cardInclude, canView, toCard, viewerMarks } from "@/lib/characters";
import { MAX_PINNED } from "@/lib/constants";

async function listPinned(userId: string) {
  const rows = await prisma.pinnedCharacter.findMany({ where: { userId }, orderBy: { position: "asc" }, include: { character: { include: cardInclude } } });
  const visible = rows.filter((r) => canView(r.character, userId));
  const marks = await viewerMarks(userId, visible.map((r) => r.characterId));
  return visible.map((r) => toCard(r.character, { id: userId, ...marks }));
}

/** GET /api/me/pinned → { items: CharacterCard[] } ordered by position. */
export const GET = route({ policy: "read" }, async ({ user }) => json({ items: await listPinned(user!.id) }));

/** POST /api/me/pinned { characterId } → { items } (max MAX_PINNED). */
export const POST = route({ policy: "write" }, async ({ req, user }) => {
  const { characterId } = await parseBody(req, z.object({ characterId: z.string().min(1) }));
  const c = await prisma.character.findUnique({ where: { id: characterId } });
  if (!c || !canView(c, user!.id)) throw new ApiError(404, "Character not found");
  const existing = await prisma.pinnedCharacter.findUnique({ where: { userId_characterId: { userId: user!.id, characterId } } });
  if (!existing) {
    const count = await prisma.pinnedCharacter.count({ where: { userId: user!.id } });
    if (count >= MAX_PINNED) throw new ApiError(400, `You can pin up to ${MAX_PINNED} characters. Unpin one first.`);
    const max = await prisma.pinnedCharacter.aggregate({ where: { userId: user!.id }, _max: { position: true } });
    await prisma.pinnedCharacter.create({ data: { userId: user!.id, characterId, position: (max._max.position ?? -1) + 1 } });
  }
  return json({ items: await listPinned(user!.id) }, { status: existing ? 200 : 201 });
});

/** PUT /api/me/pinned { order: string[] } → { items } — reorders; ids not listed keep their relative order after the listed ones. */
export const PUT = route({ policy: "write" }, async ({ req, user }) => {
  const { order } = await parseBody(req, z.object({ order: z.array(z.string()).max(MAX_PINNED) }));
  const rows = await prisma.pinnedCharacter.findMany({ where: { userId: user!.id }, orderBy: { position: "asc" } });
  const known = new Set(rows.map((r) => r.characterId));
  const sequence = [...order.filter((id) => known.has(id)), ...rows.map((r) => r.characterId).filter((id) => !order.includes(id))];
  await prisma.$transaction(sequence.map((characterId, position) => prisma.pinnedCharacter.update({ where: { userId_characterId: { userId: user!.id, characterId } }, data: { position } })));
  return json({ items: await listPinned(user!.id) });
});
