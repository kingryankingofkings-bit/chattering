import { z } from "zod";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { CONTENT_TYPES, REACTION_KINDS, contentAccess, findContent, reactionBreakdown, setContentReaction, type ContentType } from "@/lib/content";

function parseType(t: string): ContentType {
  if (!(CONTENT_TYPES as readonly string[]).includes(t)) throw new ApiError(404, "Unknown content type");
  return t as ContentType;
}

export const POST = route<{ type: string; id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const type = parseType(params.type);
  const body = await parseBody(req, z.object({ kind: z.enum(REACTION_KINDS).default("like") }));
  const row = await findContent(type, params.id);
  if (!row || contentAccess(row, user) !== "ok") throw new ApiError(404, "Not found");
  await setContentReaction(type, row.id, user!.id, body.kind);
  return json({ ok: true, reaction: body.kind, reactions: await reactionBreakdown(type, row.id) });
});

export const DELETE = route<{ type: string; id: string }>({ policy: "write" }, async ({ user, params }) => {
  const type = parseType(params.type);
  await setContentReaction(type, params.id, user!.id, null);
  return json({ ok: true, reaction: null, reactions: await reactionBreakdown(type, params.id) });
});
