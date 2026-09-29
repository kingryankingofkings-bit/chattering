/**
 * Field-level encryption for everything private: chat logs, character sheets,
 * personas, prompts, media blobs.
 *
 * Format:  enc:<keyVersion>:<iv b64>:<tag b64>:<ciphertext b64>
 * Algorithm: AES-256-GCM with a random 96-bit IV per value.
 *
 * Keys come from APP_ENCRYPTION_KEYS ("v1:<b64>,v2:<b64>"). New writes use
 * APP_ENCRYPTION_ACTIVE_KEY; reads accept any listed version, so keys can be
 * rotated without downtime (see scripts/rotate-keys.ts).
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

const PREFIX = "enc";
const ALGO = "aes-256-gcm";

type KeyRing = { active: string; keys: Map<string, Buffer> };
let ring: KeyRing | null = null;

export function parseKeyRing(spec: string, active: string): KeyRing {
  const keys = new Map<string, Buffer>();
  for (const part of spec.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx <= 0) throw new Error(`Bad key entry "${trimmed}" (expected version:base64)`);
    const version = trimmed.slice(0, idx);
    const buf = Buffer.from(trimmed.slice(idx + 1), "base64");
    if (buf.length !== 32) throw new Error(`Key ${version} must decode to 32 bytes, got ${buf.length}`);
    keys.set(version, buf);
  }
  if (!keys.has(active)) throw new Error(`Active key version "${active}" is not in APP_ENCRYPTION_KEYS`);
  return { active, keys };
}

function keyRing(): KeyRing {
  if (!ring) ring = parseKeyRing(env().APP_ENCRYPTION_KEYS, env().APP_ENCRYPTION_ACTIVE_KEY);
  return ring;
}

/** Test helper / key rotation helper: replace the in-memory ring. */
export function _setKeyRing(spec: string, active: string) {
  ring = parseKeyRing(spec, active);
}

export function encryptString(plain: string, r: KeyRing = keyRing()): string {
  const key = r.keys.get(r.active)!;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, r.active, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decryptString(value: string, r: KeyRing = keyRing()): string {
  if (!isEncrypted(value)) return value; // legacy / plaintext tolerance during migration
  const [, version, ivB64, tagB64, ctB64] = value.split(":");
  const key = r.keys.get(version);
  if (!key) throw new Error(`No decryption key for version ${version}`);
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

export function encryptBytes(data: Buffer, r: KeyRing = keyRing()): Buffer {
  const key = r.keys.get(r.active)!;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ver = Buffer.from(r.active, "utf8");
  // layout: [1 byte version length][version][12 iv][16 tag][ct]
  return Buffer.concat([Buffer.from([ver.length]), ver, iv, tag, ct]);
}

export function decryptBytes(blob: Buffer, r: KeyRing = keyRing()): Buffer {
  const vlen = blob[0];
  const version = blob.subarray(1, 1 + vlen).toString("utf8");
  const iv = blob.subarray(1 + vlen, 13 + vlen);
  const tag = blob.subarray(13 + vlen, 29 + vlen);
  const ct = blob.subarray(29 + vlen);
  const key = r.keys.get(version);
  if (!key) throw new Error(`No decryption key for version ${version}`);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export function isEncrypted(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith(`${PREFIX}:`);
}

export function keyVersionOf(value: string): string | null {
  return isEncrypted(value) ? value.split(":")[1] : null;
}

export function encryptJson<T>(data: T): string {
  return encryptString(JSON.stringify(data));
}

export function decryptJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(decryptString(value)) as T;
  } catch {
    return fallback;
  }
}

/** Re-encrypt a value under the active key if it was written with an older key. */
export function reencryptIfStale(value: string): { value: string; changed: boolean } {
  const r = keyRing();
  if (!isEncrypted(value)) return { value: encryptString(value, r), changed: true };
  if (keyVersionOf(value) === r.active) return { value, changed: false };
  return { value: encryptString(decryptString(value, r), r), changed: true };
}

/** One-way hash for lookups (session tokens, IPs). Keyed with SESSION_SECRET. */
export function hmac(value: string): string {
  return createHmac("sha256", env().SESSION_SECRET).update(value).digest("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
