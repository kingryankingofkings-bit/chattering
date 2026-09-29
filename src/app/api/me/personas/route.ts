import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { encryptJson } from "@/lib/crypto";
import { personaData, personaSchema, toPersonaDto, validatePersona } from "@/lib/personas";

/** GET /api/me/personas → { items: PersonaDto[] } */
export const GET = route({ policy: "read" }, async ({ user }) => {
  const rows = await prisma.persona.findMany({ where: { userId: user!.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  return json({ items: rows.map(toPersonaDto) });
});

/** POST /api/me/personas → { persona } */
export const POST = route({ policy: "write" }, async ({ req, user }) => {
  const body = await parseBody(req, personaSchema);
  validatePersona(body);
  const count = await prisma.persona.count({ where: { userId: user!.id } });
  if (count >= 20) throw new ApiError(400, "You can keep up to 20 personas");
  const makeDefault = body.isDefault || count === 0;
  const created = await prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.persona.updateMany({ where: { userId: user!.id, isDefault: true }, data: { isDefault: false } });
    return tx.persona.create({ data: { userId: user!.id, name: body.name, dataEnc: encryptJson(personaData(body)), isDefault: makeDefault } });
  });
  return json({ persona: toPersonaDto(created) }, { status: 201 });
});
