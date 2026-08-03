"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";

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
  beneficiarySummary: string | null;
  riskHoldUntil: string | null;
  reconciliationStatus: "PENDING" | "MATCHED" | "MISMATCHED";
  reviewerNote: string | null;
  createdAt: string;
  proofs: PaymentProofView[];
}

const PAGE_SIZE = 10;

export function PaymentTimeline() {
  const [requests, setRequests] = useState<PaymentView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const keys = useRef(new Map<string, string>());

  const refresh = useCallback(async () => {
    const response = await fetch("/api/wallet/payments", { cache: "no-store" });
    const data = await response.json().catch(() => null) as { requests?: PaymentView[]; error?: string } | null;
    if (!response.ok) throw new Error(data?.error ?? "Unable to load payment requests.");
    setRequests(data?.requests ?? []);
  }, []);

  useEffect(() => {
    void refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load payments."));
  }, [refresh]);

  // Auto-sync: poll every 30s so payment statuses (approvals, rejections) update live.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);


  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRequests = requests.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function upload(requestId: string, file: File) {
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
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to cancel payment request.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="payments-heading">
      <div>
        <h2 id="payments-heading" className="text-sm font-semibold">Payment requests</h2>
        <p className="mt-1 text-xs text-text-muted">Deposit proofs are required and verified before finance review. Optional withdrawal supporting documents use the same private quarantine and scanning workflow.</p>
      </div>
      {error && <p role="alert" className="rounded border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">{error}</p>}
      {requests.length === 0 && <p className="rounded border border-border bg-canvas px-4 py-10 text-center text-xs text-text-muted">No payment requests yet.</p>}
      <ul className="space-y-3">
        {visibleRequests.map((request) => {
          const canCancel = request.status === "PENDING" || request.status === "AWAITING_APPROVAL";
          const hasCleanProof = request.proofs.some((proof) => proof.status === "CLEAN");
          const proofRequired = request.type === "DEPOSIT" && !hasCleanProof;
          const canUploadSupport = request.status === "PENDING" && (proofRequired || request.type === "WITHDRAWAL");
          return (
            <li key={request.id} className="rounded-lg border border-border bg-canvas p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{request.type === "DEPOSIT" ? "Deposit" : "Withdrawal"} · {request.asset} {request.amount}</p>
                  <p className="mt-1 text-xs text-text-muted">{request.methodLabel} · {new Date(request.createdAt).toLocaleString()}</p>
                  {request.methodDetailsSummary && <p className="mt-1 text-xs text-text-faint">Details: {request.methodDetailsSummary}</p>}
                  {request.riskHoldUntil && new Date(request.riskHoldUntil) > new Date() && <p className="mt-1 text-xs text-brand">Beneficiary cooling-off until {new Date(request.riskHoldUntil).toLocaleString()}.</p>}
                  {request.reviewerNote && <p className="mt-1 text-xs text-text-muted">Finance note: {request.reviewerNote}</p>}
                </div>
                <span className="rounded bg-panel-2 px-2 py-1 text-[11px] text-text-muted">{request.status}</span>
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
                {request.proofs.map((proof) => <span key={proof.id} className="text-[11px] text-text-faint">Proof: {proof.status}</span>)}
                {canCancel && <Button type="button" size="sm" variant="ghost" loading={busy === request.id} onClick={() => void cancel(request.id)}>Cancel request</Button>}
                {request.reconciliationStatus === "MISMATCHED" && <span className="text-xs text-down">Settlement reconciliation needs review.</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <Pagination page={safePage} pageSize={PAGE_SIZE} totalItems={requests.length} onPageChange={setPage} label="payment requests" />
    </section>
  );
}
