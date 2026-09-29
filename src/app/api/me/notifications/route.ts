import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, parseBody, route } from "@/lib/api";
import { notificationPrefs } from "@/lib/blackbook";

const schema = z.object({
  newFromFollowed: z.boolean().optional(),
  chatReplies: z.boolean().optional(),
  moderationUpdates: z.boolean().optional(),
  productNews: z.boolean().optional(),
});

/** PUT /api/me/notifications (partial NotificationPrefs) → { notificationPrefs } */
export const PUT = route({ policy: "write" }, async ({ req, user }) => {
  const body = await parseBody(req, schema);
  const merged = { ...notificationPrefs(user!), ...body };
  await prisma.user.update({ where: { id: user!.id }, data: { notificationPrefs: JSON.stringify(merged) } });
  return json({ notificationPrefs: merged });
});
