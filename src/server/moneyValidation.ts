import { z } from "zod";
import { money } from "./ledger";

/** Canonical API representation for money: a base-10 string with at most 8 decimals. */
export const PaymentAmountSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d{0,19})(?:\.\d{1,8})?$/, "Amount must be a decimal string with at most 8 decimal places.")
  .transform((value) => money(value))
  .refine((value) => value.greaterThan(0) && value.lessThanOrEqualTo(money("1000000")), {
    message: "Amount must be between USD 0.00000001 and USD 1,000,000.",
  });
