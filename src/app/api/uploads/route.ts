import { ApiError, json, route } from "@/lib/api";
import { storeMedia } from "@/lib/storage";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

/** Detect the real image type from the bytes; never trust the declared type alone. */
function sniff(buf: Buffer): string | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  const head = buf.subarray(0, 512).toString("utf8").replace(/^﻿/, "").trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return null;
}

/** SVG is served from our origin, so anything scriptable is refused outright. */
function svgIsSafe(buf: Buffer): boolean {
  const text = buf.toString("utf8").toLowerCase();
  return !/<script|javascript:|\son[a-z]+\s*=|<foreignobject|<iframe|<embed|<object|xlink:href\s*=\s*["']?\s*(?!#|data:image)/i.test(text);
}

function dimensions(buf: Buffer, mime: string): { width?: number; height?: number } {
  try {
    if (mime === "image/png" && buf.length >= 24) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (mime === "image/jpeg") {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    if (mime === "image/webp" && buf.length >= 30) {
      const chunk = buf.toString("ascii", 12, 16);
      if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (chunk === "VP8L") { const b = buf.readUInt32LE(21); return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
      if (chunk === "VP8X") return { width: (buf.readUIntLE(24, 3) & 0xffffff) + 1, height: (buf.readUIntLE(27, 3) & 0xffffff) + 1 };
    }
  } catch {
    /* fall through */
  }
  return {};
}

/**
 * POST multipart/form-data with a `file` field (png/jpeg/webp/svg, ≤4MB).
 * Stores encrypted, PRIVATE media owned by the caller → { mediaId, url }.
 * The parent (character avatar, profile photo) flips it PUBLIC when published.
 */
export const POST = route({ policy: "write" }, async ({ req, user }) => {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES + 64 * 1024) throw new ApiError(413, "Image must be 4MB or smaller");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "Expected multipart form data with a file");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Missing file");
  if (file.size === 0) throw new ApiError(400, "That file is empty");
  if (file.size > MAX_BYTES) throw new ApiError(413, "Image must be 4MB or smaller");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime || !ALLOWED.has(mime)) throw new ApiError(415, "Use a PNG, JPEG, WebP or SVG image");
  if (mime === "image/svg+xml" && !svgIsSafe(buf)) throw new ApiError(415, "That SVG contains scripts or external references and can't be used");
  const media = await storeMedia({ ownerId: user!.id, data: buf, mime, ...dimensions(buf, mime), visibility: "PRIVATE" });
  return json({ mediaId: media.id, url: `/api/media/${media.id}` }, { status: 201 });
});
