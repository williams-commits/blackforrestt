const SENSITIVE_KEY = /(?:password|secret|token|recovery|beneficiary|document(?:url|key|path)?|authorization|cookie|mfa|private|credential|encryption|pepper)/i;
const HASH_KEY = /(?:hash|sha256|fingerprint)/i;

/** Recursively remove secrets while retaining operationally useful context. */
export function redactAuditValue(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (HASH_KEY.test(key) && typeof value === "string") {
    return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : "[HASH]";
  }
  if (Array.isArray(value)) return value.map((item) => redactAuditValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactAuditValue(childValue, childKey),
      ]),
    );
  }
  return value;
}
