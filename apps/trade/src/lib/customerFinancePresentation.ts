export type CustomerTransactionType =
  | "DEPOSIT"
  | "WITHDRAW"
  | "BONUS"
  | "COMMISSION"
  | "SWAP"
  | "TRADE_PNL"
  | "FEE"
  | "REVERSAL"
  | "NEGATIVE_BALANCE_PROTECTION";

type StoredTransactionType = CustomerTransactionType | "ADJUSTMENT";
type StoredPaymentType = "DEPOSIT" | "WITHDRAWAL" | "ADMIN_ADJUSTMENT";

const ADJUSTMENT_DESCRIPTION_PREFIXES = [
  "Administrative balance top-up:",
  "Administrative balance deduction:",
  "Administrative advance credit:",
  "Advance credit repayment:",
];

export function customerTransactionType(type: StoredTransactionType, amount: number): CustomerTransactionType {
  if (type !== "ADJUSTMENT") return type;
  return amount >= 0 ? "DEPOSIT" : "WITHDRAW";
}

export function customerPaymentType(type: StoredPaymentType, signedAmount: number): "DEPOSIT" | "WITHDRAWAL" {
  if (type !== "ADMIN_ADJUSTMENT") return type;
  return signedAmount >= 0 ? "DEPOSIT" : "WITHDRAWAL";
}

export function customerFinanceDescription(type: string, description: string | null): string | null {
  if ((type !== "ADJUSTMENT" && type !== "ADMIN_ADJUSTMENT") || description === null) return description;

  const prefix = ADJUSTMENT_DESCRIPTION_PREFIXES.find((candidate) => description.startsWith(candidate));
  if (!prefix) return description;

  return description.slice(prefix.length).trim() || null;
}

export function customerFinanceReference(type: string, reference: string | null, transactionId: string): string | null {
  if (type === "ADJUSTMENT" || type === "ADMIN_ADJUSTMENT") return `TXN-${transactionId}`;
  return reference;
}
