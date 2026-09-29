import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { destroySession, verifyPassword } from "@/lib/auth";
import { deleteMediaFile } from "@/lib/storage";

const schema = z.object({ password: z.string().min(1), confirm: z.literal("DELETE", { error: 'Type DELETE to confirm' }) });

/**
 * POST /api/me/delete { password, confirm: "DELETE" } → { ok }
 * Deletes the user row (everything cascades), wipes their encrypted media
 * blobs from disk and clears the session cookies.
 */
export const POST = route({ policy: "auth" }, async ({ req, user }) => {
  const body = await parseBody(req, schema);
  const row = await prisma.user.findUnique({ where: { id: user!.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(body.password, row.passwordHash))) throw new ApiError(403, "Password is incorrect", { field: "password" });
  const media = await prisma.media.findMany({ where: { ownerId: user!.id }, select: { storageKey: true } });
  await prisma.user.delete({ where: { id: user!.id } });
  await Promise.all(media.map((m) => deleteMediaFile(m.storageKey)));
  await destroySession();
  return json({ ok: true });
});
