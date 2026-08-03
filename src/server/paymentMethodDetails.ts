import { z } from "zod";
import { encryptSensitiveString, hashBeneficiaryDetails } from "./security/crypto";

export const PAYMENT_METHODS = ["CARD", "BANK_TRANSFER", "CRYPTO"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentFlow = "DEPOSIT" | "WITHDRAWAL";

/**
 * Payment methods disabled by the PAYMENT_METHODS_DISABLED env var
 * (a comma-separated list, e.g. "CARD,CRYPTO"). Applies to both deposit and
 * withdrawal. Empty/unset = all methods enabled. Invalid entries are ignored.
 */
export function disabledPaymentMethods(): Set<PaymentMethod> {
  const raw = process.env.PAYMENT_METHODS_DISABLED ?? "";
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toUpperCase())
      .filter(Boolean)
      .filter((entry): entry is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(entry)),
  );
}

const country = z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a two-letter country code.").transform((value) => value.toUpperCase());
const lastFour = z.string().trim().regex(/^\d{4}$/, "Enter the final four card digits.");
const shortText = z.string().trim().min(2).max(120);
const reference = z.string().trim().min(3).max(160);

const DepositCard = z.object({
  cardholderName: shortText,
  cardBrand: z.enum(["VISA", "MASTERCARD", "AMEX", "OTHER"]),
  last4: lastFour,
  providerReference: reference,
});
const DepositBank = z.object({
  accountName: shortText,
  institution: shortText,
  country,
  transferReference: reference,
});
const DepositCrypto = z.object({
  asset: z.enum(["USDT", "USDC", "BTC", "ETH"]),
  network: shortText,
  transactionHash: z.string().trim().min(12).max(256),
  senderAddress: z.string().trim().min(8).max(256).optional(),
});

const WithdrawalBank = z.object({
  accountName: shortText,
  accountNumber: z.string().trim().min(4).max(128),
  institution: shortText,
  country,
  routingCode: z.string().trim().min(2).max(64).optional(),
});
const WithdrawalCard = z.object({
  cardholderName: shortText,
  cardBrand: z.enum(["VISA", "MASTERCARD", "AMEX", "OTHER"]),
  last4: lastFour,
});
const WithdrawalCrypto = z.object({
  asset: z.enum(["USDT", "USDC", "BTC", "ETH"]),
  network: shortText,
  walletAddress: z.string().trim().min(8).max(256),
  destinationTag: z.string().trim().min(1).max(120).optional(),
});

function normalizeMethod(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toUpperCase().replace(/[()]/g, "").replace(/[\s-]+/g, "_");
  if (normalized === "BANK" || normalized === "BANK_TRANSFER") return "BANK_TRANSFER";
  if (normalized === "CARD") return "CARD";
  if (normalized.startsWith("CRYPTO")) return "CRYPTO";
  return normalized;
}

export const DepositRequestSchema = z.object({
  amount: z.any(),
  method: z.preprocess(normalizeMethod, z.enum(PAYMENT_METHODS)),
  details: z.record(z.string(), z.unknown()),
  reference: z.string().trim().min(3).max(128).optional(),
});

export const WithdrawalRequestSchema = DepositRequestSchema;

export function parseMethodDetails(flow: PaymentFlow, method: PaymentMethod, details: unknown): Record<string, string> {
  const schema = flow === "DEPOSIT"
    ? method === "CARD" ? DepositCard : method === "BANK_TRANSFER" ? DepositBank : DepositCrypto
    : method === "CARD" ? WithdrawalCard : method === "BANK_TRANSFER" ? WithdrawalBank : WithdrawalCrypto;
  const parsed = schema.parse(details);
  return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
}

export function preparePaymentMethodDetails(flow: PaymentFlow, method: PaymentMethod, details: unknown): {
  normalized: Record<string, string>;
  encrypted: string;
  fingerprint: string;
  summary: string;
} {
  const normalized = parseMethodDetails(flow, method, details);
  const canonical = JSON.stringify({ flow, method, ...normalized });
  let summary: string;
  if (method === "CARD") {
    summary = `${normalized.cardBrand} · •••• ${normalized.last4}`;
  } else if (method === "BANK_TRANSFER") {
    const account = normalized.accountNumber ? ` · •••• ${normalized.accountNumber.slice(-4)}` : "";
    summary = `${normalized.institution}${account} · ${normalized.country}`;
  } else {
    const address = normalized.walletAddress ?? normalized.senderAddress;
    const suffix = address ? ` · ${address.slice(0, 6)}…${address.slice(-4)}` : "";
    summary = `${normalized.asset} · ${normalized.network}${suffix}`;
  }
  return {
    normalized,
    encrypted: encryptSensitiveString(canonical),
    fingerprint: hashBeneficiaryDetails(canonical),
    summary,
  };
}

export function paymentMethodLabel(method: PaymentMethod | string): string {
  const normalized = normalizeMethod(method);
  if (normalized === "BANK_TRANSFER") return "Bank transfer";
  if (normalized === "CRYPTO") return "Crypto";
  if (normalized === "CARD") return "Card";
  return String(method);
}
