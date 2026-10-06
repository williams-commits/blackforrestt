import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function requiredSecret(name: string): string {
  const configured = process.env[name]?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production.`);
  }
  const fallback = process.env.AUTH_SECRET?.trim();
  if (!fallback) throw new Error(`${name} or AUTH_SECRET is required.`);
  return `${name}:${fallback}`;
}

function encryptionKey(): Buffer {
  const configured = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (configured) {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length !== 32) {
      throw new Error("FIELD_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
    }
    return decoded;
  }
  return createHash("sha256").update(requiredSecret("FIELD_ENCRYPTION_KEY")).digest();
}

export function encryptSensitiveString(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSensitiveString(payload: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = payload.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Encrypted field format is invalid.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function keyedHash(purpose: string, value: string): string {
  return createHmac("sha256", requiredSecret("SECURITY_HASH_PEPPER"))
    .update(`${purpose}:${value}`)
    .digest("hex");
}

export function hashSecurityToken(token: string): string {
  return keyedHash("security-token", token);
}

export function hashRecoveryCode(code: string): string {
  return keyedHash("mfa-recovery", normalizeRecoveryCode(code));
}

export function hashNetworkIdentifier(value: string): string {
  return keyedHash("network", value);
}

/** Keyed, non-reversible fingerprint used to recognize a payout beneficiary. */
export function hashBeneficiaryDetails(value: string): string {
  return keyedHash("payment-beneficiary", value);
}

export function randomOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomSessionId(): string {
  return `ssn_${randomOpaqueToken(24)}`;
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpUri(input: { secret: string; email: string; issuer: string }): string {
  const label = `${input.issuer}:${input.email}`;
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function verifyTotp(
  secret: string,
  code: string,
  at = Date.now(),
  window = 1,
): bigint | null {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const center = BigInt(Math.floor(at / 30_000));
  for (let offset = -window; offset <= window; offset += 1) {
    const counter = center + BigInt(offset);
    if (counter < 0n) continue;
    if (safeStringEqual(hotp(secret, counter), normalized)) return counter;
  }
  return null;
}

export function generateTotpCode(secret: string, at = Date.now()): string {
  return hotp(secret, BigInt(Math.floor(at / 30_000)));
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(10));
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
  });
}

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z2-7]/g, "");
}

function hotp(secret: string, counter: bigint): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (value % 1_000_000).toString().padStart(6, "0");
}

function safeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of input.toUpperCase().replace(/=+$/g, "")) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("TOTP secret is invalid.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}
