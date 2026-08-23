"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FilterChip } from "@/components/ui/DataTable";
import { Tooltip } from "@/components/ui/Tooltip";
import { MethodDetailsGrid } from "@/components/payments/MethodDetailsGrid";
import { fmtDateTime } from "@/lib/dates";
import { PAYMENT_PROOF_MAX_BYTES } from "@/lib/paymentProofs";
import type { ServerMessage } from "@/lib/ws/client";

interface PaymentProofView {
  id: string;
  status: "PENDING_SCAN" | "CLEAN" | "BLOCKED" | "QUARANTINED";
  declaredMime: string;
  detectedMime: string | null;
  sizeBytes: number;
  uploadedAt: string;
  finalizedAt: string | null;
}

interface PaymentView {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  status: "PENDING" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED" | "REVERSED";
  amount: string;
  asset: string;
  method: string;
  methodLabel: string;
  methodDetailsSummary: string | null;
  methodDetails: Record<string, string> | null;
  beneficiarySummary: string | null;
  riskHoldUntil: string | null;
  reconciliationStatus: "PENDING" | "MATCHED" | "MISMATCHED";
  reviewerNote: string | null;
  createdAt: string;
  proofs: PaymentProofView[];
}

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<PaymentView["status"], string> = {
  PENDING: "bg-brand-soft text-brand",
  AWAITING_APPROVAL: "bg-brand/10 text-brand border border-brand/30",
  APPROVED: "bg-up/10 text-up",
  REJECTED: "bg-down/10 text-down",
  CANCELLED: "bg-panel-3 text-text-muted",
  REVERSED: "bg-panel-3 text-text-muted border border-border",
};

const PROOF_STYLES: Record<PaymentProofView["status"], string> = {
  CLEAN: "bg-up/10 text-up",
  PENDING_SCAN: "bg-brand-soft text-brand",
  BLOCKED: "bg-down/10 text-down",
  QUARANTINED: "bg-down/10 text-down",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function PaymentTimeline() {
  const [requests, setRequests] = useState<PaymentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "DEPOSIT" | "WITHDRAWAL">("ALL");
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>());

  const refresh = useCallback(async () => {
    const response = await fetch("/api/wallet/payments", { cache: "no-store" });
    const data = await response.json().catch(() => null) as { requests?: PaymentView[]; error?: string } | null;
    if (!response.ok) throw new Error(data?.error ?? "Unable to load payment requests.");
    setRequests(data?.requests ?? []);
  }, []);

  useEffect(() => {
    void refresh()
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load payments."))
      .finally(() => setLoading(false));
  }, [refresh]);

  // Auto-sync: poll every 30s while visible so statuses update live.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh().catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  // Fund approvals/rejections/reversals arrive as ledger pushes — refresh
  // immediately instead of waiting for the 30s poll.
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const handleRealtime = (event: Event) => {
      const message = (event as CustomEvent<ServerMessage>).detail;
      if (message?.type !== "account" || message.reason !== "ledger") return;
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => void refresh().catch(() => undefined), 250);
    };
    window.addEventListener("blckforest:realtime", handleRealtime);
    return () => {
      window.removeEventListener("blckforest:realtime", handleRealtime);
      if (pending) clearTimeout(pending);
    };
  }, [refresh]);

  const filtered = useMemo(
    () => requests.filter((r) => typeFilter === "ALL" || r.type === typeFilter),
    [requests, typeFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRequests = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [typeFilter]);

  async function upload(requestId: string, file: File) {
    if (file.size > PAYMENT_PROOF_MAX_BYTES) {
      setError("The supporting document must be 1 MB or smaller.");
      return;
    }
    setBusy(requestId);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const uploaded = await fetch(`/api/wallet/payments/${requestId}/proofs/upload`, { method: "POST", body });
      const uploadData = await uploaded.json().catch(() => null) as { proofId?: string; error?: string } | null;
      if (!uploaded.ok || !uploadData?.proofId) throw new Error(uploadData?.error ?? "Proof upload failed.");
      const finalized = await fetch(`/api/wallet/payment-proofs/${uploadData.proofId}/finalize`, { method: "POST" });
      const finalizeData = await finalized.json().catch(() => null) as { error?: string } | null;
      if (!finalized.ok) throw new Error(finalizeData?.error ?? "Proof verification failed.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload the proof.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel(requestId: string) {
    setBusy(requestId);
    setError(null);
    const key = keys.current.get(requestId) ?? crypto.randomUUID();
    keys.current.set(requestId, key);
    try {
      const response = await fetch(`/api/wallet/payments/${requestId}`, {
        method: "DELETE",
        headers: { "Idempotency-Key": key },
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to cancel payment request.");
      keys.current.delete(requestId);
      setConfirmCancelId(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to cancel payment request.");
    } finally {
      setBusy(null);
    }
  }

  const pendingCount = requests.filter((r) => r.status === "PENDING" || r.status === "AWAITING_APPROVAL").length;

  return (
    <section className="space-y-4" aria-labelledby="payments-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="payments-heading" className="text-sm font-semibold">Payment requests</h2>
          <p className="mt-1 text-xs text-text-muted">Deposit proofs are required and verified before finance review. Optional withdrawal supporting documents use the same private quarantine and scanning workflow.</p>
        </div>
        {pendingCount > 0 && (
          <span className="rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-[10px] font-semibold text-brand">
            {pendingCount} awaiting review
          </span>
        )}
      </div>

      {error && <p role="alert" className="rounded border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">{error}</p>}

      <div className="flex items-center gap-1.5">
        {(["ALL", "DEPOSIT", "WITHDRAWAL"] as const).map((value) => (
          <FilterChip key={value} active={typeFilter === value} onClick={() => setTypeFilter(value)}>
            {value === "ALL" ? "All" : value === "DEPOSIT" ? "Deposits" : "Withdrawals"}
          </FilterChip>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border bg-canvas p-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {filtered.length === 0 && (
            <p className="rounded border border-border bg-canvas px-4 py-10 text-center text-xs text-text-muted">
              No {typeFilter === "ALL" ? "payment requests" : typeFilter === "DEPOSIT" ? "deposits" : "withdrawals"} yet.
            </p>
          )}
          <ul className="space-y-3">
            {visibleRequests.map((request) => {
              const canCancel = request.status === "PENDING" || request.status === "AWAITING_APPROVAL";
              const hasCleanProof = request.proofs.some((proof) => proof.status === "CLEAN");
              // Bank and crypto deposits settle against free-form transfer
              // references, so a scanned receipt is mandatory. Card deposits are
              // verified via the processor reference — a receipt is optional.
              const proofRequired = request.type === "DEPOSIT" && request.method !== "CARD" && !hasCleanProof;
              const canUploadSupport = request.status === "PENDING"
                && (proofRequired || request.type === "WITHDRAWAL" || (request.type === "DEPOSIT" && request.method === "CARD"));
              return (
                <li key={request.id} className="rounded-lg border border-border bg-canvas p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{request.type === "DEPOSIT" ? "Deposit" : "Withdrawal"} · {request.asset} {request.amount}</p>
                      <p className="mt-1 text-xs text-text-muted">{request.methodLabel} · {fmtDateTime(request.createdAt)}</p>
                    {request.methodDetailsSummary && <p className="mt-1 text-xs text-text-faint">Details: {request.methodDetailsSummary}</p>}
                    {request.riskHoldUntil && new Date(request.riskHoldUntil) > new Date() && <p className="mt-1 text-xs text-brand">Beneficiary cooling-off until {fmtDateTime(request.riskHoldUntil)}.</p>}
                    {request.reviewerNote && <p className="mt-1 text-xs text-text-muted">Finance note: {request.reviewerNote}</p>}
                    {request.methodDetails && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
                        aria-expanded={expandedId === request.id}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs text-brand hover:underline"
                      >
                        {expandedId === request.id ? "Hide full details" : "Show full details"}
                        <span aria-hidden className="text-[9px]">{expandedId === request.id ? "▲" : "▼"}</span>
                      </button>
                    )}
                  </div>
                    <span className={`rounded px-2 py-1 text-[10px] font-medium ${STATUS_STYLES[request.status]}`}>
                      {request.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {canUploadSupport && (
                      <label className="inline-flex cursor-pointer items-center rounded border border-border px-3 py-1.5 text-xs text-brand hover:bg-panel-2">
                        <input type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" disabled={busy === request.id} onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file) void upload(request.id, file);
                          event.currentTarget.value = "";
                        }} />
                        {busy === request.id ? "Uploading document…" : proofRequired ? "Upload required payment proof" : "Upload supporting document"}
                      </label>
                    )}
                    {request.proofs.map((proof) => (
                      <Tooltip key={proof.id} text={`${proof.declaredMime} · ${formatBytes(proof.sizeBytes)} · ${fmtDateTime(proof.uploadedAt)}`}>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${PROOF_STYLES[proof.status]}`}>
                          Proof · {proof.status.replaceAll("_", " ").toLowerCase()} · {formatBytes(proof.sizeBytes)}
                        </span>
                      </Tooltip>
                    ))}
                    {canCancel && (
                      <Button type="button" size="sm" variant="ghost" loading={busy === request.id} onClick={() => setConfirmCancelId(request.id)}>
                        Cancel request
                      </Button>
                    )}
                    {request.reconciliationStatus === "MISMATCHED" && <span className="text-xs text-down">Settlement reconciliation needs review.</span>}
                  </div>
                  {expandedId === request.id && request.methodDetails && (
                    <div className="mt-3 border-t border-border-soft pt-3">
                      <MethodDetailsGrid details={request.methodDetails} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination page={safePage} pageSize={PAGE_SIZE} totalItems={filtered.length} onPageChange={setPage} label="payment requests" />
        </>
      )}

      <ConfirmDialog
        open={confirmCancelId !== null}
        title="Cancel this request?"
        message="This cancels the payment request. The action cannot be undone — you would need to submit a new request to proceed."
        confirmLabel="Cancel request"
        cancelLabel="Keep it"
        busy={busy === confirmCancelId}
        onConfirm={() => confirmCancelId && void cancel(confirmCancelId)}
        onCancel={() => setConfirmCancelId(null)}
      />
    </section>
  );
}
