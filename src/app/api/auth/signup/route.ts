import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { env } from "@/lib/env";
import { encryptJson } from "@/lib/crypto";
import { defaultPrefs, defaultNotificationPrefs } from "@/lib/types";

const schema = z.object({
  email: z.string().email().max(120).transform((s) => s.trim().toLowerCase()),
  password: z.string().min(10).max(200),
  displayName: z.string().trim().min(2).max(32),
});

export const POST = route({ auth: false, ageGate: false, policy: "auth" }, async ({ req }) => {
  if (env().ALLOW_SIGNUPS !== "true") throw new ApiError(403, "Sign-ups are closed right now");
  const body = await parseBody(req, schema);
  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) throw new ApiError(409, "An account with that email already exists");
  const isFirst = (await prisma.user.count()) === 0;
  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash: await hashPassword(body.password),
      displayName: body.displayName,
      role: isFirst ? "ADMIN" : "USER",
      prefsEnc: encryptJson(defaultPrefs()),
      notificationPrefs: JSON.stringify(defaultNotificationPrefs()),
      acceptedTermsAt: new Date(),
    },
  });
  await createSession(user.id);
  return json({ ok: true, id: user.id });
});
