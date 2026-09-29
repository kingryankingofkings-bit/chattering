import { prisma } from "@/lib/db";
import { ApiError, json, route } from "@/lib/api";

/** DELETE /api/encounters/[id] → { ok: true } */
export const DELETE = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  const r = await prisma.savedEncounter.deleteMany({ where: { id: params.id, userId: user!.id } });
  if (r.count === 0) throw new ApiError(404, "Saved encounter not found");
  return json({ ok: true });
});
