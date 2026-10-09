import { z } from "zod";

/**
 * CRM bridge response contracts — the stable schema for what Trade exposes
 * about a linked platform user. Versioned so the CRM can refuse gracefully
 * on drift instead of mis-rendering. Additive changes only within v1;
 * breaking changes bump `version` and the CRM degrades.
 */

export const CLIENT_360_VERSION = 1;

export const Client360Response = z.object({
  version: z.literal(CLIENT_360_VERSION),
  user: z.object({
    id: z.string(),
    email: z.string().nullable(),
    name: z.string().nullable(),
    registeredAt: z.string(),
    state: z.string(),
    emailVerified: z.boolean(),
  }),
  account: z
    .object({
      accountNo: z.string().nullable(),
      balance: z.number(),
      equity: z.number(),
      free: z.number(),
      margin: z.number(),
      marginLevel: z.number().nullable(),
      floatingPl: z.number(),
    })
    .nullable(),
  kyc: z
    .object({
      status: z.string(),
      submittedAt: z.string().nullable(),
      reviewedAt: z.string().nullable(),
    })
    .nullable(),
  wallets: z.array(
    z.object({
      asset: z.string(),
      free: z.string(),
      locked: z.string(),
    }),
  ),
  payments: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      status: z.string(),
      amount: z.string(),
      asset: z.string(),
      createdAt: z.string(),
    }),
  ),
  openPositions: z.number().int(),
  presence: z.object({ online: z.boolean() }),
  positions: z.array(
    z.object({
      id: z.string(),
      symbol: z.string(),
      side: z.string(),
      type: z.string(),
      volume: z.string(),
      openRate: z.string(),
      currentRate: z.string(),
      netProfit: z.string(),
      openedAt: z.string(),
    }),
  ),
});

export type Client360Payload = z.infer<typeof Client360Response>;
