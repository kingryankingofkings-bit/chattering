import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { encryptJson } from "@/lib/crypto";
import { personaData, personaSchema, toPersonaDto, validatePersona } from "@/lib/personas";

/** PUT /api/me/personas/[id] → { persona } (only one default at a time). */
export const PUT = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const existing = await prisma.persona.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!existing) throw new ApiError(404, "Persona not found");
  const body = await parseBody(req, personaSchema);
  validatePersona(body);
  const updated = await prisma.$transaction(async (tx) => {
    if (body.isDefault) await tx.persona.updateMany({ where: { userId: user!.id, isDefault: true, NOT: { id: existing.id } }, data: { isDefault: false } });
    return tx.persona.update({ where: { id: existing.id }, data: { name: body.name, dataEnc: encryptJson(personaData(body)), isDefault: body.isDefault } });
  });
  return json({ persona: toPersonaDto(updated) });
});

/** DELETE /api/me/personas/[id] → { ok } */
export const DELETE = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  const existing = await prisma.persona.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!existing) throw new ApiError(404, "Persona not found");
  await prisma.persona.delete({ where: { id: existing.id } });
  if (existing.isDefault) {
    const next = await prisma.persona.findFirst({ where: { userId: user!.id }, orderBy: { createdAt: "asc" } });
    if (next) await prisma.persona.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  return json({ ok: true });
});
