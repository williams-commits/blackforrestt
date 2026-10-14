import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/Alert";

interface ReconciliationStatus {
  activeBlocks: { scope: "TRADE" | "WITHDRAW"; reason: string; createdAt: string }[];
  openCaseCount: number;
  criticalCaseCount: number;
  paymentMismatchCount: number;
  lastRun: { reference: string; status: "RUNNING" | "COMPLETED" | "FAILED"; completedAt: string | null } | null;
}

export function AccountReconciliationStatus({ status }: { status: ReconciliationStatus }) {
  const blocked = status.activeBlocks.length > 0;
  const verificationPending = status.lastRun?.status === "RUNNING" || status.lastRun?.status === "FAILED";
  const underReview = status.openCaseCount > 0 || status.paymentMismatchCount > 0 || verificationPending;
  const state = blocked ? "Restricted" : underReview ? "Under review" : "Reconciled";
  const stateClass = blocked ? "text-down bg-down/10 border-down/30" : underReview ? "text-primary bg-primary/10 border-primary/30" : "text-up bg-up/10 border-up/30";

  return (
    <section aria-labelledby="account-reconciliation-heading" className="mb-5 rounded-xl bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="account-reconciliation-heading" className="text-sm font-semibold">Account integrity and reconciliation</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Independent checks compare ledger balances, wallet projections, position settlement, and payment records.
          </p>
        </div>
        <Badge variant="secondary" role="status" className={`border ${stateClass}`}>{state}</Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Open cases" value={String(status.openCaseCount)} alert={status.openCaseCount > 0} />
        <Metric label="Critical cases" value={String(status.criticalCaseCount)} alert={status.criticalCaseCount > 0} />
        <Metric label="Payment mismatches" value={String(status.paymentMismatchCount)} alert={status.paymentMismatchCount > 0} />
        <Metric
          label="Last check"
          value={status.lastRun?.completedAt ? new Date(status.lastRun.completedAt).toLocaleString("en-US") : status.lastRun?.status ?? "Not run"}
          alert={status.lastRun?.status === "FAILED"}
        />
      </dl>

      {status.activeBlocks.length > 0 && (
        <Alert tone="err" className="mt-4">
          <strong className="font-semibold">Temporary safeguards are active</strong>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {status.activeBlocks.map((block, index) => (
              <li key={`${block.scope}-${index}`}>{block.scope === "TRADE" ? "New trades" : "Withdrawals"} blocked: {block.reason}</li>
            ))}
          </ul>
        </Alert>
      )}
    </section>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="rounded border border-border bg-muted/50 p-2.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-xs font-semibold ${alert ? "text-down" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}

export type { ReconciliationStatus };
