"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Ban, ChevronDown, ChevronUp, ClipboardCheck, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { useCommandDialog } from "@/components/ui/useCommandDialog";
import { FilterChip } from "@/components/ui/DataTable";
import { CsvExportButton } from "@/components/ui/CsvExport";
import { MethodDetailsGrid } from "@/components/payments/MethodDetailsGrid";
import { fmtDateTime } from "@/lib/dates";
import { createDeviceId } from "@/lib/device";

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

const PAGE_SIZE = 20;

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
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "DEPOSIT" | "WITHDRAWAL">("ALL");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const commandKeys = useRef(new Map<string, string>());
  const { openCommand, commandDialog } = useCommandDialog();

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = useMemo(
    () => requests.filter((r) => typeFilter === "ALL" || r.type === typeFilter),
    [requests, typeFilter],
  );
  useEffect(() => { setPage(1); }, [typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRequests = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const reviewPolicy = canPrepare && canApprove
    ? "Finance prepares and approves reviewed requests from this queue; production can enforce separate reviewers."
    : "A first finance reviewer prepares the request; a second reviewer approves the ledger settlement.";

  async function decide(id: string, action: "PREPARE" | "APPROVE" | "REJECT") {
    // One money-moving decision at a time: `busy` is a single id, so a second
    // concurrent decision re-enables the first row's buttons mid-flight.
    if (busy) return;
    const request = requests.find((item) => item.id === id);
    if (!request) return;
    const values = await openCommand({
      title: `${action === "PREPARE" ? "Prepare" : action === "APPROVE" ? "Approve" : "Reject"} ${request.type.toLowerCase()}`,
      description: action === "APPROVE"
        ? simpleApproval
          ? "Confirm settlement. Leave the reference blank to auto-generate one."
          : "Record the external settlement reference before posting the final ledger settlement."
        : "The review note becomes part of the audited payment lifecycle.",
      confirmLabel: action === "PREPARE" ? "Prepare request" : action === "APPROVE" ? "Approve settlement" : "Reject request",
      danger: action === "REJECT",
      fields: [
        ...(action === "APPROVE" ? [{ name: "externalReference", label: "Bank/payment settlement reference", required: !simpleApproval, minLength: simpleApproval ? undefined : 3, maxLength: 190, placeholder: simpleApproval ? "Auto-generated if blank" : undefined }] : []),
        { name: "note", label: action === "REJECT" ? "Rejection reason" : "Review note", type: "textarea" as const, required: action === "REJECT", minLength: action === "REJECT" ? 3 : undefined, maxLength: 1000, placeholder: action === "REJECT" ? "Explain why the request is rejected." : "Optional operational note" },
      ],
      validate: (input) => {
        if (action === "APPROVE" && !simpleApproval && (input.externalReference?.length ?? 0) < 3) return "A settlement reference is required.";
        if (action === "REJECT" && input.note.length < 3) return "A rejection reason is required.";
        return null;
      },
    });
    if (!values) return;
    const externalReference = action === "APPROVE" ? (values.externalReference || undefined) : undefined;
    const note = values.note ?? "";

    setBusy(id);
    setError(null);
    const commandName = `${id}:${action}`;
    const commandKey = commandKeys.current.get(commandName) ?? createDeviceId();
    commandKeys.current.set(commandName, commandKey);
    try {
      const response = await fetch(`/api/admin/payments/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "idempotency-key": commandKey },
        body: JSON.stringify({ action, externalReference, note: note || undefined }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to update payment request.");
      decidedIdsRef.current.add(id);
      setRequests((current) => current.filter((item) => item.id !== id));
      commandKeys.current.delete(commandName);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update payment request.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="payments-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="payments-heading" className="text-sm font-semibold">Manual payment queue</h2>
          <p className="text-xs text-muted-foreground">{reviewPolicy}</p>
        </div>
        <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{requests.length} Total</span>
      </div>
      {error && <div role="alert" className="rounded border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">{error}</div>}
      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "DEPOSIT", "WITHDRAWAL"] as const).map((value) => (
          <FilterChip key={value} active={typeFilter === value} onClick={() => setTypeFilter(value)}>
            {value === "ALL" ? "All" : value === "DEPOSIT" ? "Deposits" : "Withdrawals"}
          </FilterChip>
        ))}
        <CsvExportButton
          filename="payment-queue"
          columns={["Created", "Client", "Account", "Type", "Status", "Method", "Amount", "Reference"]}
          rows={filtered.map((r) => [
            fmtDateTime(r.createdAt), r.user.name ?? r.user.email ?? "Unknown", r.user.accountNo ?? "",
            r.type, r.status, r.methodLabel, `${r.asset} ${r.amount}`, r.userReference ?? "",
          ])}
          disabled={filtered.length === 0}
        />
      </div>
      <div className="overflow-hidden rounded-xl bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" aria-label="Expand details" />
              <TableHead>Created</TableHead><TableHead>Client</TableHead>
              <TableHead>Type</TableHead><TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead>Reference</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRequests.map((item) => (
              <Fragment key={item.id}>
                <TableRow className={expandedIds.has(item.id) ? "bg-muted/50" : undefined}>
                  <TableCell className="px-2 py-3">
                    {item.methodDetails && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(item.id)}
                        aria-expanded={expandedIds.has(item.id)}
                        aria-label={expandedIds.has(item.id) ? "Hide full payment details" : "Show full payment details"}
                        className="rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-primary"
                      >
                        {expandedIds.has(item.id) ? <ChevronUp size={13} strokeWidth={2} aria-hidden /> : <ChevronDown size={13} strokeWidth={2} aria-hidden />}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="px-3 py-3"><div className="font-medium">{item.user.name ?? item.user.email ?? "Unknown"}</div><div className="text-muted-foreground">#{item.user.accountNo ?? "—"} · {item.user.verified ? "Verified" : "Unverified"}</div></TableCell>
                  <TableCell className="px-3 py-3"><Badge variant="secondary" className={item.type === "DEPOSIT" ? "bg-(--term-success-bg) text-(--term-success-fg)" : "bg-(--term-warning-bg) text-(--term-warning-fg)"}>{item.type}</Badge></TableCell>
                  <TableCell className="px-3 py-3"><div>{item.methodLabel}</div><div className="text-xs text-muted-foreground">{item.methodDetailsSummary ?? "Details unavailable"}</div></TableCell>
                  <TableCell className="px-3 py-3 text-right font-semibold tabular-nums">{item.asset} {item.amount}</TableCell>
                  <TableCell className="px-3 py-3 text-muted-foreground">{item.userReference ?? "—"}</TableCell>
                  <TableCell className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      {item.status === "PENDING" && canPrepare && !simpleApproval && <Button size="sm" loading={busy === item.id} onClick={() => decide(item.id, "PREPARE")}><ClipboardCheck size={13} strokeWidth={2} aria-hidden /> Prepare</Button>}
                      {item.status === "PENDING" && simpleApproval && canApprove && <Button size="sm" loading={busy === item.id} onClick={() => decide(item.id, "APPROVE")}><ShieldCheck size={13} strokeWidth={2} aria-hidden /> Approve</Button>}
                      {item.status === "AWAITING_APPROVAL" && canApprove && <Button size="sm" loading={busy === item.id} onClick={() => decide(item.id, "APPROVE")}><ShieldCheck size={13} strokeWidth={2} aria-hidden /> Approve</Button>}
                      {canPrepare && <Button size="sm" variant="outline" className="text-down" disabled={busy === item.id} onClick={() => decide(item.id, "REJECT")}><Ban size={13} strokeWidth={2} aria-hidden /> Reject</Button>}
                      {!canPrepare && !canApprove && <span className="text-muted-foreground">Read only</span>}
                    </div>
                    <div className="mt-1 text-right text-xs text-muted-foreground">
                      {item.type === "DEPOSIT" && item.method !== "CARD"
                        ? `Proof: ${item.proofs.some((proof) => proof.status === "CLEAN") ? "clean" : "missing"}`
                        : item.methodDetailsSummary ?? item.beneficiarySummary ?? "Destination missing"}
                      {item.riskHoldUntil && new Date(item.riskHoldUntil) > new Date() ? " · cooling-off" : ""}
                    </div>
                  </TableCell>
                </TableRow>
                {expandedIds.has(item.id) && item.methodDetails && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={8} className="px-4 py-3">
                      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Full payment details</p>
                      <MethodDetailsGrid details={item.methodDetails} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {requests.length === 0 && <TableRow><TableCell colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No pending payment requests.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <Pagination page={safePage} pageSize={PAGE_SIZE} totalItems={filtered.length} onPageChange={setPage} label="payment requests" compact />
      </div>
      {commandDialog}
    </section>
  );
}
