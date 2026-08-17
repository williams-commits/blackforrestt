import { z } from "zod";
import { decryptSensitiveString, encryptSensitiveString, hashBeneficiaryDetails } from "./security/crypto";

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
  // Platform wallet the user was shown to pay to (set by the deposit UI when
  // admin-configured wallets exist). Recorded for finance review.
  depositAddress: z.string().trim().min(8).max(256).optional(),
  depositWalletLabel: z.string().trim().min(1).max(60).optional(),
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

/** Withdrawals are restricted to USDT (TRC20 / BEP20) and BTC (Bitcoin).
 *  The preset network list is enforced server-side — the UI presets are a
 *  convenience, not the control. Single source: lib/paymentNetworks. */
export { WITHDRAWAL_CRYPTO_NETWORKS, type WithdrawalCryptoAsset } from "@/lib/paymentNetworks";
import { WITHDRAWAL_CRYPTO_NETWORKS } from "@/lib/paymentNetworks";

const WithdrawalCrypto = z
  .object({
    asset: z.enum(["USDT", "BTC"]),
    network: shortText,
    walletAddress: z.string().trim().min(8).max(256),
    destinationTag: z.string().trim().min(1).max(120).optional(),
  })
  .superRefine((data, ctx) => {
    const allowed = WITHDRAWAL_CRYPTO_NETWORKS[data.asset];
    if (!(allowed as readonly string[]).includes(data.network)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["network"],
        message: `Network must be one of: ${allowed.join(", ")}.`,
      });
    }
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
    // Deposits: show which platform wallet the user paid to (if configured).
    const paidTo = flow === "DEPOSIT" && normalized.depositAddress
      ? ` → ${normalized.depositAddress.slice(0, 6)}…${normalized.depositAddress.slice(-4)}`
      : "";
    summary = `${normalized.asset} · ${normalized.network}${suffix}${paidTo}`;
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

const DETAIL_LABELS: Record<string, string> = {
  cardholderName: "Cardholder name",
  cardBrand: "Card brand",
  last4: "Card last four",
  providerReference: "Provider reference",
  accountName: "Account name",
  accountNumber: "Account number / IBAN",
  institution: "Institution",
  country: "Country",
  transferReference: "Transfer reference",
  routingCode: "Routing code",
  asset: "Asset",
  network: "Network",
  transactionHash: "Transaction hash",
  senderAddress: "Sender address",
  depositAddress: "Paid to deposit address",
  depositWalletLabel: "Deposit wallet label",
  walletAddress: "Destination wallet address",
  destinationTag: "Destination tag",
};

/** Decrypt stored payment method details (or legacy beneficiary details) into
 *  display-ready labeled pairs. Returns null when nothing is stored or the
 *  payload cannot be decrypted. Callers are responsible for authorization:
 *  only the owning customer or finance reviewers may receive the result. */
export function revealMethodDetails(encrypted: string | null | undefined): Record<string, string> | null {
  if (!encrypted) return null;
  try {
    const parsed = JSON.parse(decryptSensitiveString(encrypted)) as Record<string, unknown>;
    const entries = Object.entries(parsed)
      .filter(([key, value]) => key !== "flow" && key !== "method" && typeof value === "string" && value.length > 0)
      .map(([key, value]) => [
        DETAIL_LABELS[key] ?? key.replaceAll(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase()),
        String(value),
      ] as [string, string]);
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  } catch {
    return null;
  }
}
