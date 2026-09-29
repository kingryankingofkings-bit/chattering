import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, parseBody, route } from "@/lib/api";
import { toMe } from "@/lib/blackbook";

/**
 * POST /api/me/subscription { tier: "FREE" | "PLUS" } → { user }
 *
 * PLACEHOLDER: there is no payment provider wired up yet. This endpoint switches
 * the tier directly so the UI and entitlement checks can be exercised end to end.
 * When billing lands, this becomes "create checkout session" and the tier is set
 * by the provider's webhook instead.
 */
export const POST = route({ policy: "write" }, async ({ req, user }) => {
  const { tier } = await parseBody(req, z.object({ tier: z.enum(["FREE", "PLUS"]) }));
  const updated = await prisma.user.update({
    where: { id: user!.id },
    data: { subscriptionTier: tier, subscriptionRenewsAt: tier === "PLUS" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null },
  });
  const { passwordHash: _ph, ...safe } = updated;
  void _ph;
  return json({ user: toMe(safe) });
});
