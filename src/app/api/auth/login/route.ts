import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { createSession, setAgeCookie, verifyPassword } from "@/lib/auth";

const schema = z.object({ email: z.string().email().transform((s) => s.trim().toLowerCase()), password: z.string().min(1).max(200) });

export const POST = route({ auth: false, ageGate: false, policy: "auth" }, async ({ req }) => {
  const body = await parseBody(req, schema);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  const ok = user && !user.deletedAt && (await verifyPassword(body.password, user.passwordHash));
  if (!ok) throw new ApiError(401, "Email or password is incorrect");
  await createSession(user.id);
  if (user.ageVerifiedAt) await setAgeCookie();
  return json({ ok: true, ageVerified: !!user.ageVerifiedAt });
});
