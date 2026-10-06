import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Field-level secret encryption for the CRM (SMTP passwords etc.).
 *
 * AES-256-GCM with a key derived from CRM_ENCRYPTION_KEY (any non-empty
 * string; hashed to 32 bytes). Ciphertext format: v1:<iv>:<tag>:<data>, all
 * hex. Without the key, decryption is impossible — losing the key means
 * re-entering the stored SMTP passwords, not data loss elsewhere.
 */

function key(): Buffer {
  const raw = process.env.CRM_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "CRM_ENCRYPTION_KEY is required — generate one with: openssl rand -hex 32",
    );
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${data.toString("hex")}`;
}

export function decryptSecret(sealed: string): string {
  const [version, ivHex, tagHex, dataHex] = sealed.split(":");
  if (version !== "v1" || !ivHex || !tagHex || !dataHex) {
    throw new Error("Malformed encrypted secret.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}
