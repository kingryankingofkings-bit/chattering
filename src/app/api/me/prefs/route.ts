import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { encryptJson } from "@/lib/crypto";
import { checkFields } from "@/lib/safety";
import { userPrefs } from "@/lib/blackbook";

const schema = z.object({
  maxIntensity: z.number().int().min(1).max(3).optional(),
  blurNsfw: z.boolean().optional(),
  spoilerCovers: z.boolean().optional(),
  preferredThemes: z.array(z.string().trim().max(40)).max(30).optional(),
  excludedThemes: z.array(z.string().trim().max(40)).max(30).optional(),
  hardLimits: z.string().trim().max(1000).optional(),
  showPublicProfile: z.boolean().optional(),
  allowFollows: z.boolean().optional(),
  discoverableCreations: z.boolean().optional(),
});

/** PUT /api/me/prefs (partial UserPrefs) → { prefs } — merged and re-encrypted. */
export const PUT = route({ policy: "write" }, async ({ req, user }) => {
  const body = await parseBody(req, schema);
  const safety = checkFields({ hardLimits: body.hardLimits, preferredThemes: body.preferredThemes, excludedThemes: body.excludedThemes });
  if (!safety.ok) throw new ApiError(422, safety.reason, { category: safety.category, field: safety.field });
  const merged = { ...userPrefs(user!), ...body, version: 1 };
  await prisma.user.update({ where: { id: user!.id }, data: { prefsEnc: encryptJson(merged) } });
  return json({ prefs: merged });
});
