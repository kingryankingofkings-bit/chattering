import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { decryptBytes, encryptBytes, randomToken } from "./crypto";
import { env } from "./env";
import { prisma } from "./db";

/** Encrypted-at-rest blob storage on local disk. Swap for S3 by reimplementing these three functions. */
async function dir() {
  const d = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env().MEDIA_DIR);
  await mkdir(d, { recursive: true });
  return d;
}

export async function storeMedia(opts: {
  ownerId: string;
  data: Buffer;
  mime: string;
  width?: number;
  height?: number;
  visibility?: "PRIVATE" | "PUBLIC";
}) {
  const key = `${Date.now().toString(36)}-${randomToken(12)}.bin`;
  const d = await dir();
  await writeFile(path.join(d, key), encryptBytes(opts.data));
  return prisma.media.create({
    data: {
      ownerId: opts.ownerId,
      mime: opts.mime,
      bytes: opts.data.length,
      width: opts.width,
      height: opts.height,
      storageKey: key,
      visibility: opts.visibility ?? "PRIVATE",
    },
  });
}

export async function readMedia(storageKey: string): Promise<Buffer> {
  const d = await dir();
  return decryptBytes(await readFile(path.join(d, storageKey)));
}

export async function deleteMediaFile(storageKey: string) {
  const d = await dir();
  await unlink(path.join(d, storageKey)).catch(() => {});
}
