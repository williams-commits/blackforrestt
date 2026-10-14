"use client";

import { useMemo, useState } from "react";
import { CsvExportButton } from "@/components/ui/CsvExport";
import { DateInput } from "@/components/ui/Input";
import { StatCard } from "@/components/ui/StatCard";
import { fmtDateTime } from "@/lib/dates";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { RecordList, RecordStatusChip, type RecordDetailMeta } from "@/components/ui/RecordList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Txn {
  id: string;
  type: "DEPOSIT" | "WITHDRAW" | "BONUS" | "ADJUSTMENT" | "COMMISSION" | "SWAP" | "TRADE_PNL" | "FEE" | "REVERSAL" | "NEGATIVE_BALANCE_PROTECTION";
  status: "PENDING" | "COMPLETED" | "REJECTED" | "CANCELLED" | "REVERSED";
  amount: number;
  asset: string;
  description: string | null;
  reference: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<Txn["type"], string> = {
  DEPOSIT: "Deposit", WITHDRAW: "Withdrawal", BONUS: "Bonus", ADJUSTMENT: "Adjustment",
  COMMISSION: "Commission", SWAP: "Swap", TRADE_PNL: "Trade P/L", FEE: "Fee",
  REVERSAL: "Reversal", NEGATIVE_BALANCE_PROTECTION: "Balance protection",
};

const TYPE_TONES: Record<Txn["type"], "up" | "down" | "warn" | "muted"> = {
  DEPOSIT: "up", BONUS: "warn", NEGATIVE_BALANCE_PROTECTION: "up",
  WITHDRAW: "down", FEE: "down", TRADE_PNL: "warn", COMMISSION: "muted",
  SWAP: "muted", ADJUSTMENT: "muted", REVERSAL: "muted",
};

/** Transactions history on the enterprise RecordList — search, status/type
 *  filters, sortable columns, load-more, side-slide detail per entry. */
export function TransactionsTab({ transactions }: { transactions: Txn[] }) {
  const [statusFilter, setStatusFilter] = useState<"ALL" | Txn["status"]>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | Txn["type"]>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const totals = useMemo(() => {
    let net = 0;
    let monthDeposits = 0;
    let monthWithdrawals = 0;
    const now = new Date();
    for (const t of transactions) {
      if (t.status === "COMPLETED") net += t.amount;
      const d = new Date(t.createdAt);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.status === "COMPLETED") {
        if (t.type === "DEPOSIT") monthDeposits += t.amount;
        if (t.type === "WITHDRAW") monthWithdrawals += Math.abs(t.amount);
      }
    }
    return { net, monthDeposits, monthWithdrawals };
  }, [transactions]);

  const rows = useMemo(() => {
    const from = fromDate ? new Date(fromDate).getTime() : null;
    // End of the selected day (inclusive).
    const to = toDate ? new Date(toDate).getTime() + 86_399_999 : null;
    return transactions.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;
      const ts = new Date(t.createdAt).getTime();
      if (from != null && ts < from) return false;
      if (to != null && ts > to) return false;
      return true;
    });
  }, [transactions, statusFilter, typeFilter, fromDate, toDate]);

  const credit = (t: Txn) => t.amount >= 0;

  const csvRows = rows.map((t) => [
    fmtDateTime(t.createdAt), t.type, t.description ?? "", t.reference ?? "", t.status,
    `${t.amount >= 0 ? "+" : ""}${t.amount.toFixed(2)} ${t.asset}`,
  ]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Net Movement (completed)" value={`${totals.net >= 0 ? "+" : ""}${totals.net.toFixed(2)}`} tone={totals.net >= 0 ? "up" : "down"} hint="All values in USD" />
        <StatCard label="Deposits · this month" value={totals.monthDeposits.toFixed(2)} tone="up" />
        <StatCard label="Withdrawals · this month" value={totals.monthWithdrawals.toFixed(2)} tone="down" />
      </div>

      <RecordList<Txn>
        ariaLabel="Transaction"
        title="Transactions"
        description={`${rows.length} shown`}
        rows={rows}
        rowKey={(t) => t.id}
        search={{
          placeholder: "Search description or reference…",
          text: (t) => `${t.description ?? ""} ${t.reference ?? ""} ${t.type} ${t.asset}`,
        }}
        leading={(t) => ({
          icon: <span className="text-[10px] font-bold">{TYPE_LABELS[t.type].replace(/[^A-Za-z ]/g, "").split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>,
          tone: TYPE_TONES[t.type],
          title: TYPE_LABELS[t.type],
          secondary: <span className="truncate">{t.description ?? "—"}</span>,
        })}
        columns={[
          { key: "createdAt", label: "Date", sortable: true, align: "right", render: (t) => (
            <span className="text-xs text-muted-foreground tabular-nums">{fmtDateTime(t.createdAt)}</span>
          ) },
          { key: "reference", label: "Reference", render: (t) => (
            <span className="font-mono text-xs text-muted-foreground">{t.reference ?? "—"}</span>
          ) },
          { key: "status", label: "Status", render: (t) => (
            <RecordStatusChip tone={t.status === "COMPLETED" ? "up" : t.status === "PENDING" ? "warn" : t.status === "REJECTED" ? "down" : "muted"}>
              {t.status}
            </RecordStatusChip>
          ) },
          { key: "amount", label: "Amount", sortable: true, align: "right", render: (t) => (
            <span className={`font-semibold tabular-nums ${credit(t) ? "text-up" : "text-down"}`}>
              {credit(t) ? "+" : ""}{t.amount.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{t.asset}</span>
            </span>
          ) },
        ]}
        sortValue={(t, key) => {
          switch (key) {
            case "amount": return t.amount;
            case "createdAt": return new Date(t.createdAt).getTime();
            default: return String((t as unknown as Record<string, unknown>)[key] ?? "");
          }
        }}
        initialSort={{ key: "createdAt", direction: "desc" }}
        filters={
          <>
            <ChipGroup
              ariaLabel="Filter transactions by status" className="flex-wrap"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={[
                { value: "ALL", label: "All" },
                { value: "COMPLETED", label: "Completed" },
                { value: "PENDING", label: "Pending" },
                { value: "REJECTED", label: "Rejected" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
            />
            <div className="flex items-center gap-1.5">
              <DateInput value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" className="h-8 w-35" />
              <span className="text-xs text-muted-foreground">→</span>
              <DateInput value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" className="h-8 w-35" />
            </div>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "ALL" | Txn["type"])}>
              <SelectTrigger size="sm" className="w-40" aria-label="Filter by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                {[...new Set(transactions.map((t) => t.type))].sort().map((type) => (
                  <SelectItem key={type} value={type}>{TYPE_LABELS[type]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        toolbarEnd={
          <CsvExportButton filename="transactions" columns={["Date", "Type", "Description", "Reference", "Status", "Amount"]} rows={csvRows} disabled={rows.length === 0} />
        }
        detailTitle="Transaction Detail"
        renderDetailHero={(t) => (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
            <span className={`flex size-12 items-center justify-center rounded-full text-sm font-bold ${TYPE_TONES[t.type] === "up" ? "bg-up/10 text-up" : TYPE_TONES[t.type] === "down" ? "bg-down/10 text-down" : "bg-muted text-muted-foreground"}`}>
              {TYPE_LABELS[t.type].slice(0, 2)}
            </span>
            <div className="text-sm font-medium">{TYPE_LABELS[t.type]}</div>
            <div className={`text-2xl font-semibold tabular-nums ${credit(t) ? "text-up" : "text-down"}`}>
              {credit(t) ? "+" : ""}{t.amount.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{t.asset}</span>
            </div>
            <RecordStatusChip tone={t.status === "COMPLETED" ? "up" : t.status === "PENDING" ? "warn" : t.status === "REJECTED" ? "down" : "muted"}>{t.status}</RecordStatusChip>
          </div>
        )}
        renderDetailMeta={(t): RecordDetailMeta[] => [
          { label: "Description", value: t.description ?? "—" },
          { label: "Reference", value: <span className="font-mono text-xs">{t.reference ?? "—"}</span> },
          { label: "Date", value: fmtDateTime(t.createdAt) },
        ]}
        emptyTitle="No transactions match the current filters."
        emptyHint="Deposits and withdrawals will appear here."
      />
    </div>
  );
}
