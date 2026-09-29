import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { encryptString } from "@/lib/crypto";
import { checkFields } from "@/lib/safety";
import { notificationPrefs, toMe, userPrefs } from "@/lib/blackbook";

/** GET /api/me → { user, prefs, notificationPrefs } (all decrypted/shaped, never raw *Enc). */
export const GET = route({ policy: "read" }, async ({ user }) => {
  return json({ user: toMe(user!), prefs: userPrefs(user!), notificationPrefs: notificationPrefs(user!) });
});

const schema = z.object({
  displayName: z.string().trim().min(2, "Display name is too short").max(40).optional(),
  bio: z.string().trim().max(600).optional(),
  avatarMediaId: z.string().max(64).nullable().optional(),
});

/** PUT /api/me { displayName?, bio?, avatarMediaId? } → { user } */
export const PUT = route({ policy: "write" }, async ({ req, user }) => {
  const body = await parseBody(req, schema);
  const safety = checkFields({ displayName: body.displayName, bio: body.bio });
  if (!safety.ok) throw new ApiError(422, safety.reason, { category: safety.category, field: safety.field });
  if (body.avatarMediaId) {
    const m = await prisma.media.findUnique({ where: { id: body.avatarMediaId }, select: { ownerId: true } });
    if (!m || m.ownerId !== user!.id) throw new ApiError(400, "That image isn't yours", { field: "avatarMediaId" });
    // Profile photos show up on public cards, so they must be readable by everyone.
    await prisma.media.update({ where: { id: body.avatarMediaId }, data: { visibility: "PUBLIC" } });
  }
  const updated = await prisma.user.update({
    where: { id: user!.id },
    data: {
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body.bio !== undefined ? { bioEnc: body.bio ? encryptString(body.bio) : null } : {}),
      ...(body.avatarMediaId !== undefined ? { avatarMediaId: body.avatarMediaId } : {}),
    },
  });
  const { passwordHash: _ph, ...safe } = updated;
  void _ph;
  return json({ user: toMe(safe) });
});
