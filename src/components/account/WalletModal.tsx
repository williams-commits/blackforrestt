"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { toast } from "@/lib/toast";

type WalletMode = "deposit" | "withdraw";
type PaymentMethod = "CARD" | "BANK_TRANSFER" | "CRYPTO";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void | Promise<void>;
  mode?: WalletMode;
  /** When false, the Deposit tab is hidden and the mode is forced to withdraw. */
  depositEnabled?: boolean;
  /** Methods to hide from the selector (and which the API also rejects). */
  disabledMethods?: PaymentMethod[];
}

interface ApiResponse {
  error?: string;
  code?: string;
  paymentRequest?: string;
  proofId?: string;
  status?: string;
}

const EMPTY_CARD = { cardholderName: "", cardBrand: "VISA", last4: "", providerReference: "" };
const EMPTY_BANK = { accountName: "", accountNumber: "", institution: "", country: "", routingCode: "", transferReference: "" };
const EMPTY_CRYPTO = { asset: "USDT", network: "TRON (TRC20)", transactionHash: "", senderAddress: "", walletAddress: "", destinationTag: "" };

const ALL_METHODS: PaymentMethod[] = ["BANK_TRANSFER", "CARD", "CRYPTO"];
function defaultMethod(disabled: PaymentMethod[] = []): PaymentMethod {
  return ALL_METHODS.find((m) => !disabled.includes(m)) ?? "BANK_TRANSFER";
}
function requestKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}
async function readResponse(response: Response): Promise<ApiResponse> {
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return {};
  try { return await response.json() as ApiResponse; } catch { return {}; }
}
function methodLabel(method: PaymentMethod): string {
  if (method === "BANK_TRANSFER") return "Bank transfer";
  if (method === "CRYPTO") return "Crypto";
  return "Card";
}

export function WalletModal({ open, onClose, onDone, mode: initialMode = "deposit", depositEnabled = true, disabledMethods = [] }: Props) {
  const effectiveInitialMode: WalletMode = depositEnabled ? initialMode : "withdraw";
  const enabledMethods = ALL_METHODS.filter((m) => !disabledMethods.includes(m));
  const [mode, setMode] = useState<WalletMode>(initialMode);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod(disabledMethods));
  const [card, setCard] = useState(EMPTY_CARD);
  const [bank, setBank] = useState(EMPTY_BANK);
  const [cryptoDetails, setCryptoDetails] = useState(EMPTY_CRYPTO);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [needsStepUp, setNeedsStepUp] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const idempotencyKey = useRef<string | null>(null);
  const amountId = useId();
  const methodId = useId();
  const proofId = useId();

  useEffect(() => {
    if (!open) return;
    setMode(effectiveInitialMode);
    setAmount("");
    setMethod(defaultMethod(disabledMethods));
    setCard(EMPTY_CARD);
    setBank(EMPTY_BANK);
    setCryptoDetails(EMPTY_CRYPTO);
    setProofFile(null);
    setLoading(false);
    setError(null);
    setProgress(null);
    setNeedsStepUp(false);
    setCurrentPassword("");
    setMfaCode("");
    idempotencyKey.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, effectiveInitialMode]);

  function invalidateRequestKey(): void { idempotencyKey.current = null; }
  function switchMode(next: WalletMode): void {
    setMode(next);
    setMethod(defaultMethod(disabledMethods));
    setProofFile(null);
    setError(null);
    setProgress(null);
    setNeedsStepUp(false);
    invalidateRequestKey();
  }
  function changeMethod(next: PaymentMethod): void {
    setMethod(next);
    setProofFile(null);
    setError(null);
    invalidateRequestKey();
  }

  function methodDetails(): Record<string, string> {
    if (method === "CARD") {
      const base = { cardholderName: card.cardholderName.trim(), cardBrand: card.cardBrand, last4: card.last4.trim() };
      return mode === "deposit" ? { ...base, providerReference: card.providerReference.trim() } : base;
    }
    if (method === "BANK_TRANSFER") {
      return mode === "deposit"
        ? { accountName: bank.accountName.trim(), institution: bank.institution.trim(), country: bank.country.trim().toUpperCase(), transferReference: bank.transferReference.trim() }
        : { accountName: bank.accountName.trim(), accountNumber: bank.accountNumber.trim(), institution: bank.institution.trim(), country: bank.country.trim().toUpperCase(), ...(bank.routingCode.trim() ? { routingCode: bank.routingCode.trim() } : {}) };
    }
    return mode === "deposit"
      ? { asset: cryptoDetails.asset, network: cryptoDetails.network.trim(), transactionHash: cryptoDetails.transactionHash.trim(), ...(cryptoDetails.senderAddress.trim() ? { senderAddress: cryptoDetails.senderAddress.trim() } : {}) }
      : { asset: cryptoDetails.asset, network: cryptoDetails.network.trim(), walletAddress: cryptoDetails.walletAddress.trim(), ...(cryptoDetails.destinationTag.trim() ? { destinationTag: cryptoDetails.destinationTag.trim() } : {}) };
  }

  function clientValidate(): string | null {
    const canonicalAmount = amount.trim();
    if (!/^(?:(?:0|[1-9]\d{0,5})(?:\.\d{1,8})?|1000000(?:\.0{1,8})?)$/.test(canonicalAmount)) return "Enter an amount up to USD 1,000,000 with at most 8 decimal places.";
    if (method === "CARD") {
      if (!card.cardholderName.trim() || !/^\d{4}$/.test(card.last4.trim())) return "Enter the cardholder name and final four card digits.";
      if (mode === "deposit" && card.providerReference.trim().length < 3) return "Enter the card provider transaction reference.";
    }
    if (method === "BANK_TRANSFER") {
      if (!bank.accountName.trim() || !bank.institution.trim() || !/^[A-Za-z]{2}$/.test(bank.country.trim())) return "Enter the account name, institution, and two-letter country code.";
      if (mode === "deposit" && bank.transferReference.trim().length < 3) return "Enter the bank transfer reference.";
      if (mode === "withdraw" && bank.accountNumber.trim().length < 4) return "Enter the destination account number or IBAN.";
    }
    if (method === "CRYPTO") {
      if (!cryptoDetails.network.trim()) return "Select or enter the blockchain network.";
      if (mode === "deposit" && cryptoDetails.transactionHash.trim().length < 12) return "Enter the blockchain transaction hash.";
      if (mode === "withdraw" && cryptoDetails.walletAddress.trim().length < 8) return "Enter the destination wallet address.";
    }
    if (mode === "deposit" && !proofFile) return "Upload the payment receipt or transaction proof before submitting a deposit.";
    if (proofFile && proofFile.size > 10_485_760) return "The supporting document must be 10 MB or smaller.";
    return null;
  }

  async function uploadProof(paymentRequestId: string, file: File): Promise<void> {
    setProgress("Uploading supporting document…");
    const body = new FormData();
    body.set("file", file);
    const uploaded = await fetch(`/api/wallet/payments/${paymentRequestId}/proofs/upload`, { method: "POST", body });
    const uploadData = await readResponse(uploaded);
    if (!uploaded.ok || !uploadData.proofId) throw new Error(uploadData.error ?? "Supporting document upload failed.");
    setProgress("Scanning and sealing supporting document…");
    const finalized = await fetch(`/api/wallet/payment-proofs/${uploadData.proofId}/finalize`, { method: "POST" });
    const finalizeData = await readResponse(finalized);
    if (!finalized.ok) throw new Error(finalizeData.error ?? "Supporting document verification failed.");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setProgress(null);
    const validation = clientValidate();
    if (validation) { setError(validation); return; }

    setLoading(true);
    idempotencyKey.current ??= requestKey();
    try {
      if (mode === "withdraw" && needsStepUp) {
        setProgress("Confirming withdrawal security…");
        const stepUp = await fetch("/api/security/step-up", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, code: mfaCode }) });
        const stepUpData = await readResponse(stepUp);
        if (!stepUp.ok) throw new Error(stepUpData.error ?? "Step-up authentication failed.");
      }

      setProgress(`Creating ${mode} request…`);
      const response = await fetch(mode === "deposit" ? "/api/wallet/deposit" : "/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.current },
        body: JSON.stringify({ amount: amount.trim(), method, details: methodDetails() }),
      });
      const data = await readResponse(response);
      if (!response.ok) {
        if (data.code === "STEP_UP_REQUIRED") setNeedsStepUp(true);
        throw new Error(data.error ?? `Request failed with status ${response.status}.`);
      }
      if (!data.paymentRequest) throw new Error("The server did not return a payment request identifier.");

      if (proofFile) {
        try {
          await uploadProof(data.paymentRequest, proofFile);
        } catch (uploadError) {
          await Promise.resolve(onDone());
          toast.error("Document upload failed", `${uploadError instanceof Error ? uploadError.message : "Upload failed."} The ${mode} request was created; open Payments to retry the document upload.`);
          setProgress(null);
          idempotencyKey.current = null;
          return;
        }
      }

      toast.success(`${mode === "deposit" ? "Deposit" : "Withdrawal"} request submitted`, "Your request has been queued for finance review.");
      setProgress(null);
      idempotencyKey.current = null;
      await Promise.resolve(onDone());
      onClose();
    } catch (cause) {
      toast.error("Request failed", cause instanceof Error ? cause.message : "The request could not be confirmed. Retry safely using the same operation.");
    } finally {
      setLoading(false);
    }
  }

  const isDeposit = mode === "deposit";
  return (
    <Dialog open={open} onClose={loading ? () => undefined : onClose} title="Wallet" description={isDeposit ? "Create a deposit request and upload proof for finance review." : "Reserve available funds for a reviewed withdrawal."} className="max-w-xl">
      <div className="max-h-[min(82dvh,760px)] overflow-y-auto overscroll-contain p-4 sm:p-5">
        <div className={`mb-5 grid ${depositEnabled ? "grid-cols-2" : "grid-cols-1"} gap-1 rounded border border-border bg-panel-2 p-0.5 text-xs`} role="tablist" aria-label="Wallet operation">
          {depositEnabled && (
            <button type="button" role="tab" aria-selected={isDeposit} onClick={() => switchMode("deposit")} className={`rounded py-2 ${isDeposit ? "bg-up font-medium text-white" : "text-text-muted hover:text-text"}`}>Deposit</button>
          )}
          <button type="button" role="tab" aria-selected={!isDeposit} onClick={() => switchMode("withdraw")} className={`rounded py-2 ${!isDeposit ? "bg-down font-medium text-white" : "text-text-muted hover:text-text"}`}>Withdraw</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor={amountId} className="mb-1 block text-[11px] text-text-muted">Amount (USD)</label>
            <div className="relative"><span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">$</span><input id={amountId} type="number" inputMode="decimal" min="0.00000001" max="1000000" step="any" required value={amount} onChange={(event) => { setAmount(event.target.value); invalidateRequestKey(); }} placeholder="0.00" className="h-10 w-full rounded border border-border bg-canvas pl-7 pr-2 text-sm outline-none focus:border-brand" /></div>
            <div className="mt-2 grid grid-cols-4 gap-1" aria-label="Preset amounts">{[100,500,1000,5000].map((value) => <button key={value} type="button" onClick={() => { setAmount(String(value)); invalidateRequestKey(); }} className="h-8 rounded bg-panel-2 text-[11px] text-text-muted hover:bg-panel-3">{value.toLocaleString("en-US")}</button>)}</div>
          </div>

          <div>
            <label htmlFor={methodId} className="mb-1 block text-[11px] text-text-muted">Method</label>
            <select id={methodId} value={method} onChange={(event) => changeMethod(event.target.value as PaymentMethod)} className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm">
              {enabledMethods.map((m) => (
                <option key={m} value={m}>{methodLabel(m)}</option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-3 rounded border border-border-soft p-3 sm:p-4">
            <legend className="px-1 text-xs font-medium">{isDeposit ? "Payment source" : "Withdrawal destination"} · {methodLabel(method)}</legend>
            {method === "CARD" && <>
              <p className="text-[11px] text-text-faint">For PCI safety, never enter a full card number or CVV. Only the brand and final four digits are collected.</p>
              <input required maxLength={120} value={card.cardholderName} onChange={(e) => setCard((v) => ({...v, cardholderName:e.target.value}))} placeholder="Cardholder name" aria-label="Cardholder name" className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm" />
              <div className="grid grid-cols-2 gap-2"><select value={card.cardBrand} onChange={(e) => setCard((v)=>({...v,cardBrand:e.target.value}))} aria-label="Card brand" className="h-10 rounded border border-border bg-canvas px-3 text-sm"><option>VISA</option><option>MASTERCARD</option><option>AMEX</option><option>OTHER</option></select><input required inputMode="numeric" pattern="\d{4}" maxLength={4} value={card.last4} onChange={(e)=>setCard((v)=>({...v,last4:e.target.value.replace(/\D/g,"").slice(0,4)}))} placeholder="Last 4 digits" aria-label="Last four card digits" className="h-10 rounded border border-border bg-canvas px-3 text-sm" /></div>
              {isDeposit && <input required maxLength={160} value={card.providerReference} onChange={(e)=>setCard((v)=>({...v,providerReference:e.target.value}))} placeholder="Card processor transaction reference" aria-label="Card processor transaction reference" className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm" />}
            </>}
            {method === "BANK_TRANSFER" && <>
              <input required maxLength={120} value={bank.accountName} onChange={(e)=>setBank((v)=>({...v,accountName:e.target.value}))} placeholder={isDeposit ? "Sender account name" : "Beneficiary account name"} aria-label="Account name" className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm" />
              {!isDeposit && <input required maxLength={128} value={bank.accountNumber} onChange={(e)=>setBank((v)=>({...v,accountNumber:e.target.value}))} placeholder="Account number or IBAN" aria-label="Account number or IBAN" className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm" />}
              <div className="grid grid-cols-[1fr_100px] gap-2"><input required maxLength={120} value={bank.institution} onChange={(e)=>setBank((v)=>({...v,institution:e.target.value}))} placeholder="Bank / institution" aria-label="Bank or institution" className="h-10 min-w-0 rounded border border-border bg-canvas px-3 text-sm" /><input required maxLength={2} value={bank.country} onChange={(e)=>setBank((v)=>({...v,country:e.target.value.toUpperCase()}))} placeholder="US" aria-label="Country code" className="h-10 rounded border border-border bg-canvas px-3 text-sm uppercase" /></div>
              {isDeposit ? <input required maxLength={160} value={bank.transferReference} onChange={(e)=>setBank((v)=>({...v,transferReference:e.target.value}))} placeholder="Bank transfer reference" aria-label="Bank transfer reference" className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm" /> : <input maxLength={64} value={bank.routingCode} onChange={(e)=>setBank((v)=>({...v,routingCode:e.target.value}))} placeholder="Routing / SWIFT / BIC (optional)" aria-label="Routing or SWIFT code" className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm" />}
            </>}
            {method === "CRYPTO" && <>
              <div className="grid grid-cols-[110px_1fr] gap-2"><select value={cryptoDetails.asset} onChange={(e)=>setCryptoDetails((v)=>({...v,asset:e.target.value}))} aria-label="Crypto asset" className="h-10 rounded border border-border bg-canvas px-3 text-sm"><option>USDT</option><option>USDC</option><option>BTC</option><option>ETH</option></select><input required maxLength={120} value={cryptoDetails.network} onChange={(e)=>setCryptoDetails((v)=>({...v,network:e.target.value}))} placeholder="Network, e.g. TRON (TRC20)" aria-label="Blockchain network" className="h-10 min-w-0 rounded border border-border bg-canvas px-3 text-sm" /></div>
              {isDeposit ? <><input required maxLength={256} value={cryptoDetails.transactionHash} onChange={(e)=>setCryptoDetails((v)=>({...v,transactionHash:e.target.value}))} placeholder="Transaction hash" aria-label="Transaction hash" className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm" /><input maxLength={256} value={cryptoDetails.senderAddress} onChange={(e)=>setCryptoDetails((v)=>({...v,senderAddress:e.target.value}))} placeholder="Sender wallet address (optional)" aria-label="Sender wallet address" className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm" /></> : <><input required maxLength={256} value={cryptoDetails.walletAddress} onChange={(e)=>setCryptoDetails((v)=>({...v,walletAddress:e.target.value}))} placeholder="Destination wallet address" aria-label="Destination wallet address" className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm" /><input maxLength={120} value={cryptoDetails.destinationTag} onChange={(e)=>setCryptoDetails((v)=>({...v,destinationTag:e.target.value}))} placeholder="Destination tag / memo (optional)" aria-label="Destination tag or memo" className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm" /></>}
            </>}
          </fieldset>

          {!isDeposit && needsStepUp && <div className="space-y-3 rounded border border-brand/30 bg-brand-soft p-3"><p className="text-xs text-text-muted">Confirm this withdrawal with your password and authenticator or recovery code.</p><input type="password" required maxLength={128} value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} autoComplete="current-password" placeholder="Current password" aria-label="Current password" className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm" /><input type="text" required maxLength={64} value={mfaCode} onChange={(e)=>setMfaCode(e.target.value)} autoComplete="one-time-code" placeholder="Authenticator or recovery code" aria-label="Authenticator or recovery code" className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm" /></div>}

          <div><label htmlFor={proofId} className="mb-1 block text-[11px] text-text-muted">{isDeposit ? "Payment proof (required)" : "Supporting document (optional)"}</label><input id={proofId} type="file" accept="image/jpeg,image/png,application/pdf" required={isDeposit} onChange={(event)=>{setProofFile(event.currentTarget.files?.[0] ?? null); invalidateRequestKey();}} className="block w-full rounded border border-border bg-canvas p-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-panel-2 file:px-3 file:py-2 file:text-xs" /><p className="mt-1 text-[11px] text-text-faint">JPEG, PNG, or PDF, maximum 10 MB. Files are quarantined, scanned, and stored privately.</p></div>

          {progress && <p role="status" className="rounded border border-brand/20 bg-brand-soft px-3 py-2 text-xs text-text-muted">{progress}</p>}
          {error && <div role="alert" className="rounded border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">{error}</div>}
          <Button type="submit" variant={isDeposit ? "buy" : "sell"} loading={loading} loadingLabel={progress ?? (isDeposit ? "Submitting deposit" : "Submitting withdrawal")} className="w-full">{isDeposit ? "Submit deposit" : "Submit withdrawal"}</Button>
          <p className="text-center text-[11px] text-text-faint">Requests are not settled automatically. Finance review, reconciliation, and provider confirmation remain required.</p>
        </form>
      </div>
    </Dialog>
  );
}
