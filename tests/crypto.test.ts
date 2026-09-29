import { describe, expect, it } from "vitest";
import { decryptBytes, decryptJson, decryptString, encryptBytes, encryptJson, encryptString, isEncrypted, keyVersionOf, parseKeyRing, reencryptIfStale } from "@/lib/crypto";

describe("crypto", () => {
  it("round-trips strings and JSON", () => {
    const ct = encryptString("hello, night");
    expect(isEncrypted(ct)).toBe(true);
    expect(ct).not.toContain("hello");
    expect(decryptString(ct)).toBe("hello, night");
    const obj = { a: 1, b: ["x", "y"] };
    expect(decryptJson(encryptJson(obj), null)).toEqual(obj);
  });

  it("uses a fresh IV per value", () => {
    expect(encryptString("same")).not.toBe(encryptString("same"));
  });

  it("writes with the active key and reads older versions", () => {
    const ring = parseKeyRing(process.env.APP_ENCRYPTION_KEYS!, "v1");
    const old = encryptString("legacy", ring);
    expect(keyVersionOf(old)).toBe("v1");
    expect(decryptString(old)).toBe("legacy");
    const r = reencryptIfStale(old);
    expect(r.changed).toBe(true);
    expect(keyVersionOf(r.value)).toBe("v2");
    expect(reencryptIfStale(r.value).changed).toBe(false);
  });

  it("rejects tampered ciphertext", () => {
    const ct = encryptString("integrity");
    const parts = ct.split(":");
    parts[4] = Buffer.from("tampered!!").toString("base64");
    expect(() => decryptString(parts.join(":"))).toThrow();
  });

  it("round-trips binary blobs", () => {
    const data = Buffer.from([0, 1, 2, 250, 251, 252]);
    expect(decryptBytes(encryptBytes(data)).equals(data)).toBe(true);
  });

  it("tolerates plaintext during migration", () => {
    expect(decryptString("not encrypted")).toBe("not encrypted");
    expect(decryptJson("{}", { x: 1 })).toEqual({});
  });
});
