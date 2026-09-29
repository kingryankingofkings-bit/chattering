/**
 * Re-encrypts every encrypted column and media blob under the active key.
 * Usage: add the new key to APP_ENCRYPTION_KEYS, set APP_ENCRYPTION_ACTIVE_KEY, then `npm run rotate-keys`.
 * Old keys can be removed from the env once this finishes.
 */
import { PrismaClient } from "@prisma/client";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { decryptBytes, encryptBytes, reencryptIfStale } from "../src/lib/crypto";
import { env } from "../src/lib/env";

const prisma = new PrismaClient();

async function rotateTable<T extends { id: string }>(name: string, rows: T[], fields: (keyof T)[], update: (id: string, data: Partial<T>) => Promise<unknown>) {
  let changed = 0;
  for (const row of rows) {
    const data: Partial<T> = {};
    let dirty = false;
    for (const f of fields) {
      const v = row[f];
      if (typeof v !== "string" || !v) continue;
      const r = reencryptIfStale(v);
      if (r.changed) {
        (data as Record<string, unknown>)[f as string] = r.value;
        dirty = true;
      }
    }
    if (dirty) {
      await update(row.id, data);
      changed++;
    }
  }
  console.log(`${name}: ${changed}/${rows.length} re-encrypted`);
}

async function main() {
  await rotateTable("users", await prisma.user.findMany(), ["bioEnc", "prefsEnc"], (id, data) => prisma.user.update({ where: { id }, data }));
  await rotateTable("personas", await prisma.persona.findMany(), ["dataEnc"], (id, data) => prisma.persona.update({ where: { id }, data }));
  await rotateTable("characters", await prisma.character.findMany(), ["sheetEnc"], (id, data) => prisma.character.update({ where: { id }, data }));
  await rotateTable("chats", await prisma.chat.findMany(), ["contextEnc", "summaryEnc"], (id, data) => prisma.chat.update({ where: { id }, data }));
  await rotateTable("messages", await prisma.message.findMany(), ["contentEnc"], (id, data) => prisma.message.update({ where: { id }, data }));
  await rotateTable("reports", await prisma.report.findMany(), ["detailsEnc"], (id, data) => prisma.report.update({ where: { id }, data }));
  await rotateTable("appeals", await prisma.appeal.findMany(), ["messageEnc"], (id, data) => prisma.appeal.update({ where: { id }, data }));
  await rotateTable("encounters", await prisma.savedEncounter.findMany(), ["dataEnc"], (id, data) => prisma.savedEncounter.update({ where: { id }, data }));
  await rotateTable("comics", await prisma.comic.findMany(), ["pagesEnc"], (id, data) => prisma.comic.update({ where: { id }, data }));
  await rotateTable("stories", await prisma.story.findMany(), ["contentEnc"], (id, data) => prisma.story.update({ where: { id }, data }));
  await rotateTable("images", await prisma.generatedImage.findMany(), ["promptEnc", "negativeEnc"], (id, data) => prisma.generatedImage.update({ where: { id }, data }));

  const dir = path.resolve(process.cwd(), env().MEDIA_DIR);
  const media = await prisma.media.findMany();
  let n = 0;
  for (const m of media) {
    const p = path.join(dir, m.storageKey);
    try {
      const blob = await readFile(p);
      const vlen = blob[0];
      const version = blob.subarray(1, 1 + vlen).toString("utf8");
      if (version === env().APP_ENCRYPTION_ACTIVE_KEY) continue;
      await writeFile(p, encryptBytes(decryptBytes(blob)));
      n++;
    } catch (err) {
      console.warn(`media ${m.id}: ${String(err)}`);
    }
  }
  console.log(`media: ${n}/${media.length} re-encrypted`);
}

main().finally(() => prisma.$disconnect());
