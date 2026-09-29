import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { setAgeCookie } from "@/lib/auth";
export const POST = route({ ageGate: false, policy: "auth" }, async ({ req, user }) => {
  const { confirm } = await parseBody(req, z.object({ confirm: z.literal(true) }));
  if (!confirm) throw new ApiError(400, "Confirmation required");
  await prisma.user.update({ where: { id: user!.id }, data: { ageVerifiedAt: new Date(), acceptedTermsAt: new Date() } });
  await setAgeCookie();
  return json({ ok: true });
});
