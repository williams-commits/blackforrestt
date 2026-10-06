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

/**
 * Validate a deposit address against the format its asset/network implies.
 * Returns an error message, or null when the address is structurally valid.
 * Prevents placeholder/example values (e.g. "TXyZ...abc") from ever being
 * shown to users as payable addresses.
 */
export function validateDepositAddress(asset: string, network: string, address: string): string | null {
  const key = `${asset} ${network}`.toUpperCase();
  if (key.includes("TRC20") || key.includes("TRON")) {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)
      ? null
      : "Not a valid TRON address — expected 34 characters starting with T (no dots/ellipsis).";
  }
  if (key.includes("BEP20") || key.includes("BNB") || key.includes("ERC20") || key.includes("ETHEREUM") || asset === "ETH" || asset === "USDC") {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
      ? null
      : "Not a valid EVM address — expected 0x followed by 40 hexadecimal characters.";
  }
  if (asset === "BTC" || key.includes("BITCOIN")) {
    return /^(bc1[a-z0-9]{39,59}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address)
      ? null
      : "Not a valid Bitcoin address (bc1…, 1…, or 3… format).";
  }
  return address.length >= 20 ? null : "Address looks too short to be valid.";
}
