"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tooltip } from "@/components/ui/Tooltip";
import { Badge } from "@/components/ui/badge";
import { RecordList, RecordStatusChip } from "@/components/ui/RecordList";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Upload } from "lucide-react";
import { MethodDetailsGrid } from "@/components/payments/MethodDetailsGrid";
import { fmtDateTime } from "@/lib/dates";
import { PAYMENT_PROOF_MAX_BYTES, compressProofImage, isHeicFile } from "@/lib/paymentProofs";
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
  userReference: string | null;
  externalReference: string | null;
  methodDetailsSummary: string | null;
  methodDetails: Record<string, string> | null;
  beneficiarySummary: string | null;
  riskHoldUntil: string | null;
  reconciliationStatus: "PENDING" | "MATCHED" | "MISMATCHED";
  reviewerNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  events: Array<{ type: string; createdAt: string }>;
  proofs: PaymentProofView[];
}

const STATUS_TONES: Record<PaymentView["status"], "up" | "down" | "warn" | "brand" | "muted"> = {
  PENDING: "warn",
  AWAITING_APPROVAL: "brand",
  APPROVED: "up",
  REJECTED: "down",
  CANCELLED: "muted",
  REVERSED: "muted",
};

const PROOF_STYLES: Record<PaymentProofView["status"], string> = {
  CLEAN: "bg-(--term-success-bg) text-(--term-success-fg)",
  PENDING_SCAN: "bg-(--term-warning-bg) text-(--term-warning-fg)",
  BLOCKED: "bg-(--term-danger-bg) text-(--term-danger-fg)",
  QUARANTINED: "bg-(--term-danger-bg) text-(--term-danger-fg)",
};

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Request created",
  PROOF_RECEIVED: "Document received",
  PROOF_FINALIZED: "Document verified",
  PROOF_BLOCKED: "Document blocked",
  PREPARED: "Prepared for review",
  APPROVED: "Approved by finance",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  REVERSED: "Reversed",
  RECONCILED: "Reconciled with settlement",
  RISK_REJECTED: "Rejected by risk checks",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/** Payment requests on the enterprise RecordList — proof upload, cancel and
 *  full settlement details live in the side-slide detail panel. */
export function PaymentTimeline() {
  const [busy, setBusy] = useState<string | null>(null);
  // Action failures (cancel/upload) are distinct from query failures.
  const [actionError, setActionError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "DEPOSIT" | "WITHDRAWAL">("ALL");
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>());

  // Server state via react-query: 30s auto-sync (pauses in background tabs);
  // ledger pushes (fund approvals/rejections/reversals) invalidate immediately.
  const queryClient = useQueryClient();
  const { data, isPending, error: queryError } = useQuery({
    queryKey: ["account-payments"],
    queryFn: async () => {
      const response = await fetch("/api/wallet/payments", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { requests?: PaymentView[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Unable to load payment requests.");
      return payload?.requests ?? [];
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
  const requests = useMemo(() => data ?? [], [data]);
  const loading = isPending;
  const error = queryError instanceof Error ? queryError.message : null;
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["account-payments"] });
  }, [queryClient]);

  // Ledger pushes arrive as realtime events — refresh immediately instead of
  // waiting for the 30s poll.
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const handleRealtime = (event: Event) => {
      const message = (event as CustomEvent<ServerMessage>).detail;
      if (message?.type !== "account" || message.reason !== "ledger") return;
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => void refresh(), 250);
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

  async function upload(requestId: string, file: File) {
    setBusy(requestId);

    try {
      if (await isHeicFile(file)) {
        setActionError("iPhone HEIC photos aren’t supported. Convert the photo to JPEG or PNG (or take a screenshot of it) and try again.");
        return;
      }
      // Oversized JPEG/PNG images are resized locally; PDFs must already fit.
      const prepared = await compressProofImage(file, PAYMENT_PROOF_MAX_BYTES);
      if (prepared.size > PAYMENT_PROOF_MAX_BYTES) {
        setActionError("The supporting document must be 1 MB or smaller. Images are resized automatically — export a smaller PDF or a more compressed image.");
        return;
      }
      const body = new FormData();
      body.set("file", prepared);
      const uploaded = await fetch(`/api/wallet/payments/${requestId}/proofs/upload`, { method: "POST", body });
      const uploadData = await uploaded.json().catch(() => null) as { proofId?: string; error?: string } | null;
      if (!uploaded.ok || !uploadData?.proofId) throw new Error(uploadData?.error ?? "Proof upload failed.");
      const finalized = await fetch(`/api/wallet/payment-proofs/${uploadData.proofId}/finalize`, { method: "POST" });
      const finalizeData = await finalized.json().catch(() => null) as { error?: string } | null;
      if (!finalized.ok) throw new Error(finalizeData?.error ?? "Proof verification failed.");
      setActionError(null);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to upload the proof.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel(requestId: string) {
    setBusy(requestId);

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
      setActionError(null);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to cancel payment request.");
    } finally {
      setBusy(null);
    }
  }

  const pendingCount = requests.filter((r) => r.status === "PENDING" || r.status === "AWAITING_APPROVAL").length;
  const detail = requests.find((r) => r.id === detailId) ?? null;

  return (
    <div className="space-y-4">
      {(error ?? actionError) && <Alert tone="err">{error ?? actionError}</Alert>}

      <RecordList<PaymentView>
        ariaLabel="Payment"
        title="Payment requests"
        description="Deposit proofs are required and verified before finance review."
        rows={filtered}
        rowKey={(r) => r.id}
        loading={loading}
        leading={(r) => ({
          icon: <span className="text-[10px] font-bold">{r.type === "DEPOSIT" ? "IN" : "OUT"}</span>,
          tone: r.type === "DEPOSIT" ? "up" : "down",
          title: `${r.type === "DEPOSIT" ? "Deposit" : "Withdrawal"} · ${r.asset} ${r.amount}`,
          secondary: `${r.methodLabel} · ${fmtDateTime(r.createdAt)}`,
        })}
        columns={[
          { key: "reference", label: "Reference", render: (r) => (
            <span className="font-mono text-xs text-muted-foreground">{r.userReference ?? r.externalReference ?? "—"}</span>
          ) },
          { key: "status", label: "Status", render: (r) => (
            <RecordStatusChip tone={STATUS_TONES[r.status]}>{r.status.replaceAll("_", " ")}</RecordStatusChip>
          ) },
          { key: "amount", label: "Amount", sortable: true, align: "right", render: (r) => (
            <span className="font-semibold tabular-nums">{Number(r.amount).toFixed(2)}</span>
          ) },
          { key: "createdAt", label: "Created", sortable: true, align: "right", render: (r) => (
            <span className="text-xs text-muted-foreground tabular-nums">{fmtDateTime(r.createdAt)}</span>
          ) },
        ]}
        sortValue={(r, key) => {
          switch (key) {
            case "amount": return Number(r.amount);
            case "createdAt": return new Date(r.createdAt).getTime();
            default: return String((r as unknown as Record<string, unknown>)[key] ?? "");
          }
        }}
        initialSort={{ key: "createdAt", direction: "desc" }}
        filters={
          <>
            <ChipGroup
              ariaLabel="Filter payment requests by type" className="flex-wrap"
              value={typeFilter}
              onChange={(value) => setTypeFilter(value)}
              options={[
                { value: "ALL", label: "All" },
                { value: "DEPOSIT", label: "Deposits" },
                { value: "WITHDRAWAL", label: "Withdrawals" },
              ]}
            />
            {pendingCount > 0 && (
              <Badge variant="secondary" className="border border-primary/30 bg-primary/10 text-primary">
                {pendingCount} awaiting review
              </Badge>
            )}
          </>
        }
        detailTitle="Payment Detail"
        onRowActivate={(r) => setDetailId(r.id)}
      />

      {/* Side-slide detail (controlled — stays mounted across refreshes) */}
      {detail != null && <PaymentDetailSheet
        request={detail}
        busy={busy === detail.id}
        onOpenChange={(open) => { if (!open) setDetailId(null); }}
        onUpload={(file) => void upload(detail.id, file)}
        onCancel={() => setConfirmCancelId(detail.id)}
      />}

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
    </div>
  );
}

/** The slide-over detail for one payment request: status hero, settlement
 *  metadata, proofs, upload/cancel actions. */
function PaymentDetailSheet({
  request,
  busy,
  onOpenChange,
  onUpload,
  onCancel,
}: {
  request: PaymentView;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => void;
  onCancel: () => void;
}) {
  const canCancel = request.status === "PENDING" || request.status === "AWAITING_APPROVAL";
  const hasCleanProof = request.proofs.some((proof) => proof.status === "CLEAN");
  // Bank and crypto deposits settle against free-form transfer references,
  // so a scanned receipt is mandatory. Card deposits are verified via the
  // processor reference — a receipt is optional.
  const proofRequired = request.type === "DEPOSIT" && request.method !== "CARD" && !hasCleanProof;
  const canUploadSupport = request.status === "PENDING"
    && (proofRequired || request.type === "WITHDRAWAL" || (request.type === "DEPOSIT" && request.method === "CARD"));

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="space-y-1 pb-2">
          <SheetTitle>{request.type === "DEPOSIT" ? "Deposit Detail" : "Withdrawal Detail"}</SheetTitle>
          <SheetDescription>{request.methodLabel}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
            <span className={`flex size-12 items-center justify-center rounded-full text-sm font-bold ${request.type === "DEPOSIT" ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>
              {request.type === "DEPOSIT" ? "IN" : "OUT"}
            </span>
            <div className="text-sm font-medium">{request.type === "DEPOSIT" ? "Deposit" : "Withdrawal"}</div>
            <div className="text-2xl font-semibold tabular-nums">
              {Number(request.amount).toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{request.asset}</span>
            </div>
            <RecordStatusChip tone={STATUS_TONES[request.status]}>{request.status.replaceAll("_", " ")}</RecordStatusChip>
          </div>

          <dl className="space-y-3">
            <DetailRow label="Type" value={request.type === "DEPOSIT" ? "Deposit" : "Withdrawal"} />
            <DetailRow label="Asset" value={request.asset} />
            <DetailRow label="Method" value={request.methodLabel} />
            {request.userReference && <DetailRow label="Your reference" value={<span className="font-mono text-xs">{request.userReference}</span>} />}
            <DetailRow label="Created" value={fmtDateTime(request.createdAt)} />
            {request.reviewedAt && <DetailRow label="Reviewed" value={fmtDateTime(request.reviewedAt)} />}
            {request.methodDetailsSummary && <DetailRow label="Method details" value={request.methodDetailsSummary} />}
            {request.beneficiarySummary && <DetailRow label="Beneficiary" value={request.beneficiarySummary} />}
            {request.riskHoldUntil && new Date(request.riskHoldUntil) > new Date() && (
              <DetailRow label="Cooling-off until" value={<span className="text-primary">{fmtDateTime(request.riskHoldUntil)}</span>} />
            )}
            <DetailRow label="Reconciliation" value={
              <RecordStatusChip tone={request.reconciliationStatus === "MATCHED" ? "up" : request.reconciliationStatus === "MISMATCHED" ? "down" : "muted"}>
                {request.reconciliationStatus}
              </RecordStatusChip>
            } />
            <DetailRow label="Documents" value={`${request.proofs.length} uploaded`} />
            {request.reviewerNote && <DetailRow label="Finance note" value={request.reviewerNote} />}
          </dl>

          {request.events.length > 0 && (
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="text-xs font-medium text-muted-foreground">Timeline</div>
              <ol className="mt-3 space-y-2.5">
                {[...request.events].reverse().map((event, index) => (
                  <li key={`${event.type}-${index}`} className="flex items-center gap-2.5 text-xs">
                    <span className={`size-1.5 shrink-0 rounded-full ${index === request.events.length - 1 ? "bg-primary" : "bg-muted-foreground/50"}`} aria-hidden />
                    <span className="font-medium text-foreground">{EVENT_LABELS[event.type] ?? event.type.replaceAll("_", " ").toLowerCase()}</span>
                    <span className="ml-auto text-muted-foreground tabular-nums">{fmtDateTime(event.createdAt)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {request.methodDetails && (
            <div className="rounded-xl bg-muted/40 p-4">
              <MethodDetailsGrid details={request.methodDetails} />
            </div>
          )}

          {request.proofs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {request.proofs.map((proof) => (
                <Tooltip key={proof.id} text={`${proof.declaredMime} · ${formatBytes(proof.sizeBytes)} · ${fmtDateTime(proof.uploadedAt)}`}>
                  <Badge variant="secondary" className={`font-normal ${PROOF_STYLES[proof.status]}`}>
                    Proof · {proof.status.replaceAll("_", " ").toLowerCase()} · {formatBytes(proof.sizeBytes)}
                  </Badge>
                </Tooltip>
              ))}
            </div>
          )}

          {(canUploadSupport || canCancel) && (
            <div className="flex flex-col gap-2">
              {canUploadSupport && (
                <label className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input bg-background text-xs font-medium shadow-xs transition-colors hover:bg-accent/60">
                  <Upload size={13} strokeWidth={2} aria-hidden />
                  <input type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" disabled={busy} onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) onUpload(file);
                    event.currentTarget.value = "";
                  }} />
                  {busy ? "Uploading document…" : proofRequired ? "Upload required payment proof" : "Upload supporting document"}
                </label>
              )}
              {canCancel && (
                <Button type="button" variant="outline" size="sm" className="w-full text-down" loading={busy} onClick={onCancel}>
                  Cancel request
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
