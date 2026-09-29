import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { createSession, destroyAllSessions, hashPassword, verifyPassword } from "@/lib/auth";

const schema = z.object({ current: z.string().min(1, "Enter your current password"), next: z.string().min(10, "Use at least 10 characters").max(200) });

/** POST /api/me/password { current, next } → { ok }. Signs every other device out; this session is re-issued. */
export const POST = route({ policy: "auth" }, async ({ req, user }) => {
  const body = await parseBody(req, schema);
  const row = await prisma.user.findUnique({ where: { id: user!.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(body.current, row.passwordHash))) throw new ApiError(403, "Current password is incorrect", { field: "current" });
  if (body.current === body.next) throw new ApiError(400, "Choose a different password", { field: "next" });
  await prisma.user.update({ where: { id: user!.id }, data: { passwordHash: await hashPassword(body.next) } });
  await destroyAllSessions(user!.id);
  await createSession(user!.id);
  return json({ ok: true });
});
