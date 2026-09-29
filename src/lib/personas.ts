import "server-only";
import { z } from "zod";
import type { Persona } from "@prisma/client";
import { ApiError } from "./api";
import { decryptJson } from "./crypto";
import { checkFields } from "./safety";
import type { PersonaData } from "./types";

export const personaSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  pronouns: z.string().trim().max(40).default(""),
  description: z.string().trim().max(2000).default(""),
  likes: z.string().trim().max(1000).default(""),
  limits: z.string().trim().max(1000).default(""),
  isDefault: z.boolean().default(false),
});
export type PersonaInput = z.infer<typeof personaSchema>;

export type PersonaDto = { id: string; name: string; pronouns: string; description: string; likes: string; limits: string; isDefault: boolean; createdAt: string; updatedAt: string };

export function toPersonaDto(p: Persona): PersonaDto {
  const d = decryptJson<Partial<PersonaData>>(p.dataEnc, {});
  return { id: p.id, name: p.name, pronouns: d.pronouns ?? "", description: d.description ?? "", likes: d.likes ?? "", limits: d.limits ?? "", isDefault: p.isDefault, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() };
}

export function validatePersona(body: PersonaInput) {
  const s = checkFields({ name: body.name, pronouns: body.pronouns, description: body.description, likes: body.likes, limits: body.limits });
  if (!s.ok) throw new ApiError(422, s.reason, { category: s.category, field: s.field });
}

export function personaData(body: PersonaInput): PersonaData {
  return { version: 1, pronouns: body.pronouns, description: body.description, likes: body.likes, limits: body.limits };
}
