/**
 * Client/shared helpers for the payment-method feature flag. The authoritative
 * enabled/disabled set lives server-side (src/server/paymentMethodDetails.ts,
 * reading PAYMENT_METHODS_DISABLED); this mirrors it for server components
 * that pass the disabled list down to client components as a serializable prop.
 */
export const ALL_PAYMENT_METHODS = ["CARD", "BANK_TRANSFER", "CRYPTO"] as const;
export type PaymentMethodName = (typeof ALL_PAYMENT_METHODS)[number];

/**
 * Parse PAYMENT_METHODS_DISABLED (e.g. "CARD,CRYPTO") into a list of method
 * names. Intended to be called in a server component where process.env is
 * available; the result is passed to client components as a prop.
 */
export function disabledPaymentMethodNames(
  raw = process.env.PAYMENT_METHODS_DISABLED ?? "",
): PaymentMethodName[] {
  return raw
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean)
    .filter((entry): entry is PaymentMethodName =>
      (ALL_PAYMENT_METHODS as readonly string[]).includes(entry),
    );
}
