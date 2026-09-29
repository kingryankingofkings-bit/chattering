import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { readMedia } from "@/lib/storage";

/** Streams a decrypted media blob. Private media is only served to its owner (or moderators). */
export const GET = route<{ id: string }>({ policy: "read" }, async ({ user, params }) => {
  const media = await prisma.media.findUnique({ where: { id: params.id } });
  if (!media) throw new ApiError(404, "Not found");
  const allowed = media.visibility === "PUBLIC" || media.ownerId === user!.id || user!.role !== "USER";
  if (!allowed) throw new ApiError(403, "Private");
  const data = await readMedia(media.storageKey);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": media.mime,
      "content-length": String(data.length),
      "cache-control": media.visibility === "PUBLIC" ? "public, max-age=31536000, immutable" : "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
});
