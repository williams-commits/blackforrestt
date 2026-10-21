"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Ban, ClipboardCheck, CreditCard, FileText, Hash, ShieldCheck, X } from "lucide-react";
import { RecordList, RecordStatusChip } from "@/components/ui/RecordList";
import { IdentityTile } from "@/components/ui/Initial";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/Textarea";
import { SimpleDialog } from "@/components/ui/Dialog";
import { CsvExportButton } from "@/components/ui/CsvExport";
import { MethodDetailsGrid } from "@/components/payments/MethodDetailsGrid";
import { fmtDateTime } from "@/lib/dates";
import { createDeviceId } from "@/lib/device";
import { SectionHeader } from "./SectionHeader";

export interface PaymentRequestRow {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  status: "PENDING" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED" | "REVERSED";
  amount: string;
  asset: string;
  method: string;
  methodLabel: string;
  methodDetailsSummary: string | null;
  methodDetails: Record<string, string> | null;
  userReference: string | null;
  externalReference: string | null;
  reviewerNote: string | null;
  beneficiarySummary: string | null;
  riskHoldUntil: string | null;
  preparedAt: string | null;
  proofs: { status: "PENDING_SCAN" | "CLEAN" | "BLOCKED" | "QUARANTINED" }[];
  createdAt: string;
  user: { email: string | null; name: string | null; accountNo: string | null; verified: boolean };
}

export function PaymentsReview({
  initialRequests,
  canPrepare = false,
  canApprove = false,
  simpleApproval = false,
}: {
  initialRequests: PaymentRequestRow[];
  canPrepare?: boolean;
  canApprove?: boolean;
  simpleApproval?: boolean;
}) {
  const [requests, setRequests] = useState(initialRequests);

  // Sync local state when the parent's polled data changes (auto-sync). Rows
  // this operator already decided are kept out — a poll response that was in
  // flight when the decision landed still contains them, and re-adding them
  // reads as "my approval didn't stick".
  const decidedIdsRef = useRef(new Set<string>());
  useEffect(() => {
    setRequests(initialRequests.filter((item) => !decidedIdsRef.current.has(item.id)));
  }, [initialRequests]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "DEPOSIT" | "WITHDRAWAL">("ALL");
  const commandKeys = useRef(new Map<string, string>());
  // Open decision form (SimpleDialog) — one money-moving decision at a time.
  const [decision, setDecision] = useState<{ action: "PREPARE" | "APPROVE" | "REJECT"; request: PaymentRequestRow } | null>(null);
  const [note, setNote] = useState("");
  const [externalReference, setExternalReference] = useState("");


  const filtered = useMemo(
    () => requests.filter((r) => typeFilter === "ALL" || r.type === typeFilter),
    [requests, typeFilter],
  );

  const reviewPolicy = canPrepare && canApprove
    ? "Finance prepares and approves reviewed requests from this queue; production can enforce separate reviewers."
    : "A first finance reviewer prepares the request; a second reviewer approves the ledger settlement.";

  function openDecision(id: string, action: "PREPARE" | "APPROVE" | "REJECT") {
    if (busy) return;
    const request = requests.find((item) => item.id === id);
    if (!request) return;
    setNote("");
    setExternalReference("");
    setDecision({ action, request });
  }

  async function submitDecision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision || busy) return;
    const { action, request } = decision;
    if (action === "APPROVE" && !simpleApproval && externalReference.trim().length < 3) return;
    if (action === "REJECT" && note.trim().length < 3) return;

    setBusy(request.id);
    setError(null);
    const commandName = `${request.id}:${action}`;
    const commandKey = commandKeys.current.get(commandName) ?? createDeviceId();
    commandKeys.current.set(commandName, commandKey);
    try {
      const response = await fetch(`/api/admin/payments/${request.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "idempotency-key": commandKey },
        body: JSON.stringify({ action, externalReference: action === "APPROVE" ? (externalReference.trim() || undefined) : undefined, note: note.trim() || undefined }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to update payment request.");
      decidedIdsRef.current.add(request.id);
      setRequests((current) => current.filter((item) => item.id !== request.id));
      commandKeys.current.delete(commandName);
      setDecision(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update payment request.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Manual payment review" className="space-y-3">
      <SectionHeader icon={<CreditCard size={16} strokeWidth={2} aria-hidden />} title="Manual payment review" description={reviewPolicy} />
      {error && <Alert tone="err">{error}</Alert>}
      <RecordList<PaymentRequestRow>
        ariaLabel="Request"
        title="Payment queue"
        description={`${filtered.length} of ${requests.length} requests`}
        rows={filtered}
        rowKey={(r) => r.id}
        search={{ placeholder: "Search client, reference, or method…", text: (r) => `${r.user.name ?? ""} ${r.user.email ?? ""} ${r.userReference ?? ""} ${r.methodLabel}` }}
        filters={
          <ChipGroup
            ariaLabel="Filter payment requests by type"
            value={typeFilter}
            onChange={(value) => setTypeFilter(value)}
            options={[
              { value: "ALL", label: "All" },
              { value: "DEPOSIT", label: "Deposits" },
              { value: "WITHDRAWAL", label: "Withdrawals" },
            ]}
          />
        }
        toolbarEnd={
          <CsvExportButton
            filename="payment-queue"
            columns={["Created", "Client", "Account", "Type", "Status", "Method", "Amount", "Reference"]}
            rows={filtered.map((r) => [
              fmtDateTime(r.createdAt), r.user.name ?? r.user.email ?? "Unknown", r.user.accountNo ?? "",
              r.type, r.status, r.methodLabel, `${r.asset} ${r.amount}`, r.userReference ?? "",
            ])}
            disabled={filtered.length === 0}
          />
        }
        leading={(r) => ({
          icon: r.type === "DEPOSIT"
            ? <ArrowDownToLine size={15} strokeWidth={2} aria-hidden />
            : <ArrowUpFromLine size={15} strokeWidth={2} aria-hidden />,
          tone: r.type === "DEPOSIT" ? "up" : "down",
          title: `${r.user.name ?? r.user.email ?? "Unknown"}`,
          secondary: `${r.methodLabel} · #${r.user.accountNo ?? "—"} · ${r.user.verified ? "Verified" : "Unverified"}`,
        })}
        columns={[
          { key: "createdAt", label: "Created", sortable: true, align: "right", render: (r) => (
            <span className="text-xs text-muted-foreground tabular-nums">{fmtDateTime(r.createdAt)}</span>
          ) },
          { key: "status", label: "Status", render: (r) => (
            <RecordStatusChip tone={r.status === "PENDING" ? "warn" : r.status === "AWAITING_APPROVAL" ? "brand" : r.status === "APPROVED" ? "up" : "down"}>
              {r.status.replaceAll("_", " ")}
            </RecordStatusChip>
          ) },
          { key: "proof", label: "Proof", render: (r) => (
            <span className="text-xs text-muted-foreground">
              {r.type === "DEPOSIT" && r.method !== "CARD"
                ? (r.proofs.some((proof) => proof.status === "CLEAN") ? "clean" : "missing")
                : r.methodDetailsSummary ?? r.beneficiarySummary ?? "—"}
            </span>
          ) },
          { key: "amount", label: "Amount", sortable: true, align: "right", render: (r) => (
            <span className={`font-semibold tabular-nums ${r.type === "DEPOSIT" ? "text-up" : "text-down"}`}>
              {r.type === "DEPOSIT" ? "+" : "−"} {r.asset} {Number(r.amount).toFixed(2)}
            </span>
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
        detailTitle={undefined}
        onRowActivate={undefined}
        renderDetailHero={(r) => (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
            <IdentityTile size="lg" tone={r.type === "DEPOSIT" ? "up" : "down"}>
              {r.type === "DEPOSIT" ? <ArrowDownToLine size={20} strokeWidth={2} aria-hidden /> : <ArrowUpFromLine size={20} strokeWidth={2} aria-hidden />}
            </IdentityTile>
            <div className="text-sm font-medium">{r.type === "DEPOSIT" ? "Deposit · credit" : "Withdrawal · debit"}</div>
            <div className={`text-2xl font-semibold tabular-nums ${r.type === "DEPOSIT" ? "text-up" : "text-down"}`}>
              {r.type === "DEPOSIT" ? "+" : "−"} {r.asset} {Number(r.amount).toFixed(2)}
            </div>
            <RecordStatusChip tone={r.status === "PENDING" ? "warn" : r.status === "AWAITING_APPROVAL" ? "brand" : r.status === "APPROVED" ? "up" : "down"}>
              {r.status.replaceAll("_", " ")}
            </RecordStatusChip>
          </div>
        )}
        renderDetailMeta={(r) => [
          { label: "Client", value: `${r.user.name ?? r.user.email ?? "Unknown"} · #${r.user.accountNo ?? "—"}` },
          { label: "Method", value: r.methodDetailsSummary ?? r.methodLabel },
          ...(r.beneficiarySummary ? [{ label: "Beneficiary", value: r.beneficiarySummary }] : []),
          { label: "Client reference", value: r.userReference ?? "—" },
          ...(r.externalReference ? [{ label: "External reference", value: r.externalReference }] : []),
          { label: "Created", value: fmtDateTime(r.createdAt) },
          ...(r.riskHoldUntil && new Date(r.riskHoldUntil) > new Date() ? [{ label: "Cooling-off until", value: fmtDateTime(r.riskHoldUntil) }] : []),
          ...(r.reviewerNote ? [{ label: "Reviewer note", value: r.reviewerNote }] : []),
          { label: "Documents", value: `${r.proofs.length} uploaded` },
        ]}
        renderDetailExtra={(r) => (
          <div className="space-y-3">
            {r.methodDetails && (
              <div className="rounded-xl bg-muted/40 p-4">
                <MethodDetailsGrid details={r.methodDetails} />
              </div>
            )}
            {(canPrepare || canApprove) && r.status !== "APPROVED" && r.status !== "REJECTED" && (
              <div className="flex flex-col gap-2">
                {r.status === "PENDING" && canPrepare && !simpleApproval && <Button size="sm" loading={busy === r.id} onClick={() => openDecision(r.id, "PREPARE")}><ClipboardCheck size={13} strokeWidth={2} aria-hidden /> Prepare</Button>}
                {r.status === "PENDING" && simpleApproval && canApprove && <Button size="sm" loading={busy === r.id} onClick={() => openDecision(r.id, "APPROVE")}><ShieldCheck size={13} strokeWidth={2} aria-hidden /> Approve</Button>}
                {r.status === "AWAITING_APPROVAL" && canApprove && <Button size="sm" loading={busy === r.id} onClick={() => openDecision(r.id, "APPROVE")}><ShieldCheck size={13} strokeWidth={2} aria-hidden /> Approve</Button>}
                {canPrepare && <Button size="sm" variant="outline" className="text-down" disabled={busy === r.id} onClick={() => openDecision(r.id, "REJECT")}><Ban size={13} strokeWidth={2} aria-hidden /> Reject</Button>}
              </div>
            )}
          </div>
        )}
        emptyTitle="No pending payment requests."
      />

      <SimpleDialog
        open={decision !== null}
        onClose={() => { if (!busy) setDecision(null); }}
        title={decision ? `${decision.action === "PREPARE" ? "Prepare" : decision.action === "APPROVE" ? "Approve settlement" : "Reject"} ${decision.request.type.toLowerCase()} · ${decision.request.user.name ?? decision.request.user.email ?? "client"}` : ""}
        description={
          decision?.action === "APPROVE"
            ? simpleApproval
              ? "Confirm the ledger settlement. Leave the reference blank to auto-generate one."
              : "Record the external settlement reference before posting the final ledger settlement."
            : "The review note becomes part of the audited payment lifecycle."
        }
        className="sm:max-w-md"
      >
        <form onSubmit={submitDecision} className="p-5 space-y-4">
          {decision?.action === "APPROVE" && (
            <div>
              <Label htmlFor="payment-reference" className="mb-1 block text-xs font-medium text-muted-foreground">
                Settlement reference {simpleApproval ? "(optional — auto-generated when blank)" : "(required)"}
              </Label>
              <Input
                id="payment-reference"
                type="text"
                maxLength={190}
                value={externalReference}
                onChange={(e) => setExternalReference(e.target.value)}
                placeholder={simpleApproval ? "Auto-generated if blank" : "Bank/payment settlement reference"}
                startIcon={<Hash size={13} strokeWidth={2} aria-hidden />}
              />
            </div>
          )}
          <div>
            <Label htmlFor="payment-note" className="mb-1 block text-xs font-medium text-muted-foreground">
              {decision?.action === "REJECT" ? "Rejection reason (required)" : "Review note (optional)"}
            </Label>
            <Textarea
              id="payment-note"
              maxLength={1000}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={decision?.action === "REJECT" ? "Explain why the request is rejected." : "Optional operational note"}
              startIcon={<FileText size={13} strokeWidth={2} aria-hidden />}
            />
          </div>
          {error && <Alert tone="err">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => setDecision(null)}>
              <X size={13} strokeWidth={2} aria-hidden /> Cancel
            </Button>
            <Button
              type="submit"
              variant={decision?.action === "REJECT" ? "destructive" : "default"}
              loading={busy !== null}
              loadingLabel="Submitting"
              disabled={Boolean(decision && decision.action === "APPROVE" && !simpleApproval && externalReference.trim().length < 3) || Boolean(decision?.action === "REJECT" && note.trim().length < 3)}
            >
              {decision?.action === "PREPARE" ? <><ClipboardCheck size={13} strokeWidth={2} aria-hidden /> Prepare request</>
                : decision?.action === "APPROVE" ? <><ShieldCheck size={13} strokeWidth={2} aria-hidden /> Approve settlement</>
                : <><Ban size={13} strokeWidth={2} aria-hidden /> Reject request</>}
            </Button>
          </div>
        </form>
      </SimpleDialog>
    </section>
  );
}
