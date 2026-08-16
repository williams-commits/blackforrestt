"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { useCommandDialog } from "@/components/ui/useCommandDialog";
import { FilterChip } from "@/components/ui/DataTable";
import { CsvExportButton } from "@/components/ui/CsvExport";
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

  // Sync local state when the parent's polled data changes (auto-sync).
  useEffect(() => { setRequests(initialRequests); }, [initialRequests]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "DEPOSIT" | "WITHDRAWAL">("ALL");
  const commandKeys = useRef(new Map<string, string>());
  const { openCommand, commandDialog } = useCommandDialog();

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
          <p className="text-xs text-text-muted">{reviewPolicy}</p>
        </div>
        <span className="rounded bg-panel-2 px-2 py-1 text-xs text-text-muted">{requests.length} Total</span>
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
      <div className="overflow-x-auto rounded-lg border border-border bg-canvas">
        <table className="w-full min-w-225 text-left text-xs">
          <thead className="bg-panel-2 text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Created</th><th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Method</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th><th className="px-3 py-2 font-medium">Reference</th>
              <th className="px-3 py-2 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleRequests.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-3 text-text-muted">{new Date(item.createdAt).toLocaleString()}</td>
                <td className="px-3 py-3"><div className="font-medium">{item.user.name ?? item.user.email ?? "Unknown"}</div><div className="text-text-faint">#{item.user.accountNo ?? "—"} · {item.user.verified ? "Verified" : "Unverified"}</div></td>
                <td className="px-3 py-3"><span className={`rounded px-1.5 py-0.5 ${item.type === "DEPOSIT" ? "bg-up/10 text-up" : "bg-brand-soft text-brand"}`}>{item.type}</span></td>
                <td className="px-3 py-3"><div>{item.methodLabel}</div><div className="text-[10px] text-text-faint">{item.methodDetailsSummary ?? "Details unavailable"}</div></td>
                <td className="px-3 py-3 text-right font-semibold tnum">{item.asset} {item.amount}</td>
                <td className="px-3 py-3 text-text-muted">{item.userReference ?? "—"}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    {item.status === "PENDING" && canPrepare && !simpleApproval && <Button size="sm" loading={busy === item.id} onClick={() => decide(item.id, "PREPARE")}>Prepare</Button>}
                    {item.status === "PENDING" && simpleApproval && canApprove && <Button size="sm" loading={busy === item.id} onClick={() => decide(item.id, "APPROVE")}>Approve</Button>}
                    {item.status === "AWAITING_APPROVAL" && canApprove && <Button size="sm" loading={busy === item.id} onClick={() => decide(item.id, "APPROVE")}>Approve</Button>}
                    {canPrepare && <Button size="sm" variant="ghost" disabled={busy === item.id} onClick={() => decide(item.id, "REJECT")}>Reject</Button>}
                    {!canPrepare && !canApprove && <span className="text-text-faint">Read only</span>}
                  </div>
                  <div className="mt-1 text-right text-[10px] text-text-faint">
                    {item.type === "DEPOSIT" ? `Proof: ${item.proofs.some((proof) => proof.status === "CLEAN") ? "clean" : "missing"}` : item.methodDetailsSummary ?? item.beneficiarySummary ?? "Destination missing"}
                    {item.riskHoldUntil && new Date(item.riskHoldUntil) > new Date() ? " · cooling-off" : ""}
                  </div>
                </td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-text-muted">No pending payment requests.</td></tr>}
          </tbody>
        </table>
        <Pagination page={safePage} pageSize={PAGE_SIZE} totalItems={filtered.length} onPageChange={setPage} label="payment requests" compact />
      </div>
      {commandDialog}
    </section>
  );
}
