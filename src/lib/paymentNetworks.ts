/**
 * Withdrawal crypto restrictions — shared by the server-side Zod schema
 * (enforcement) and the WalletModal UI (preset selects). Kept in lib/ so the
 * client can import it without pulling server-only modules into the bundle.
 *
 * Withdrawals are restricted to USDT (TRC20 / BEP20) and BTC (Bitcoin).
 */
export const WITHDRAWAL_CRYPTO_NETWORKS = {
  USDT: ["TRON (TRC20)", "BNB Smart Chain (BEP20)"],
  BTC: ["Bitcoin"],
} as const;

export type WithdrawalCryptoAsset = keyof typeof WITHDRAWAL_CRYPTO_NETWORKS;
