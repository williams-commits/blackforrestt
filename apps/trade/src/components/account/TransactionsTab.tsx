"use client";

import { useEffect, useMemo, useState } from "react";
import { Pagination } from "@/components/ui/Pagination";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { RecordShell, RecordSortButton, RecordLabel, MobileSortSelect, type SortDirection } from "@/components/ui/RecordList";
import { FilterChip, TableSearch } from "@/components/ui/DataTable";
import { CsvExportButton } from "@/components/ui/CsvExport";
import { StatCard } from "@/components/ui/StatCard";
import { Tooltip } from "@/components/ui/Tooltip";
import { fmtDateTime } from "@/lib/dates";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Input } from "@/components/ui/Input";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

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

const PAGE_SIZE = 20;

type SortKey = "createdAt" | "amount";

const SORT_OPTIONS: Array<{ key: SortKey; direction: SortDirection; label: string }> = [
  { key: "createdAt", direction: "desc", label: "Newest first" },
  { key: "createdAt", direction: "asc", label: "Oldest first" },
  { key: "amount", direction: "desc", label: "Amount high→low" },
  { key: "amount", direction: "asc", label: "Amount low→high" },
];

/** Transactions history: filters, date range, search, CSV export — record
 *  rows (grid columns on desktop, stacked cards on phones). */
export function TransactionsTab({ transactions }: { transactions: Txn[] }) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"ALL" | Txn["status"]>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | Txn["type"]>("ALL");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "createdAt", direction: "desc" });
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    // End of the selected day (inclusive).
    const to = toDate ? new Date(toDate).getTime() + 86_399_999 : null;
    return transactions.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;
      const ts = new Date(t.createdAt).getTime();
      if (from != null && ts < from) return false;
      if (to != null && ts > to) return false;
      if (query) {
        const haystack = `${t.description ?? ""} ${t.reference ?? ""} ${t.type} ${t.asset}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [transactions, statusFilter, typeFilter, search, fromDate, toDate]);

  const rows = useMemo(() => {
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) =>
      sort.key === "amount" ? (a.amount - b.amount) * dir : (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir,
    );
  }, [filtered, sort]);

  useEffect(() => { setPage(1); }, [statusFilter, typeFilter, search, fromDate, toDate]);

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

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSort = (key: string) => {
    setSort((prev) =>
      prev.key === key
        ? { key: prev.key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key: key as SortKey, direction: "desc" },
    );
  };

  const copyReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopiedRef(reference);
      setTimeout(() => setCopiedRef(null), 2000);
    } catch { /* clipboard blocked — reference stays selectable */ }
  };

  const money = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hasActiveFilters = statusFilter !== "ALL" || typeFilter !== "ALL" || search !== "" || fromDate !== "" || toDate !== "";

  const csvRows = rows.map((t) => [
    fmtDateTime(t.createdAt), t.type, t.description ?? "", t.reference ?? "", t.status,
    `${t.amount >= 0 ? "+" : ""}${t.amount.toFixed(2)} ${t.asset}`,
  ]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Net Movement (completed)" value={`${totals.net >= 0 ? "+" : ""}${money(totals.net)}`} tone={totals.net >= 0 ? "up" : "down"} hint="All values in USD" />
        <StatCard label="Deposits · this month" value={money(totals.monthDeposits)} tone="up" />
        <StatCard label="Withdrawals · this month" value={money(totals.monthWithdrawals)} tone="down" />
      </div>

      <RecordShell
        ariaLabel="Transactions"
        footer={<Pagination page={safePage} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={setPage} label="transactions" />}
        toolbar={
          <>
            <TableSearch value={search} onChange={setSearch} placeholder="Search description or reference…" label="Search transactions" />
            <NativeSelect
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "ALL" | Txn["type"])}
              aria-label="Filter by type"
              className="h-8"
            >
              <option value="ALL">All types</option>
              {[...new Set(transactions.map((t) => t.type))].sort().map((type) => <option key={type} value={type}>{type}</option>)}
            </NativeSelect>
            <div className="flex items-center gap-1">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" className="h-8" />
              <span className="text-(length:--term-text-2xs) text-text-faint">→</span>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" className="h-8" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(["ALL", "COMPLETED", "PENDING", "REJECTED", "CANCELLED"] as const).map((value) => (
                <FilterChip key={value} active={statusFilter === value} onClick={() => setStatusFilter(value)}>
                  {value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase()}
                </FilterChip>
              ))}
            </div>
            <MobileSortSelect
              value={`${sort.key}:${sort.direction}`}
              onChange={(next) => setSort(next as { key: SortKey; direction: SortDirection })}
              options={SORT_OPTIONS}
            />
            <span className="ml-auto text-(length:--term-text-2xs) text-text-faint tnum">{rows.length} shown</span>
            <CsvExportButton filename="transactions" columns={["Date", "Type", "Description", "Reference", "Status", "Amount"]} rows={csvRows} disabled={rows.length === 0} />
          </>
        }
      >
        {/* Column header — desktop only */}
        <div className="hidden md:grid md:grid-cols-[1.1fr_0.9fr_minmax(0,2.2fr)_1.2fr_1fr_1.1fr] md:items-center md:gap-3 border-b border-border-soft bg-panel-2/50 px-3 py-2 text-(length:--term-text-2xs) font-medium uppercase tracking-wide text-text-faint" aria-hidden="true">
          <RecordSortButton label="Date" sortKey="createdAt" sort={sort} onSort={onSort} />
          <RecordLabel>Type</RecordLabel>
          <RecordLabel>Description</RecordLabel>
          <RecordLabel>Reference</RecordLabel>
          <RecordLabel>Status</RecordLabel>
          <RecordSortButton label="Amount" sortKey="amount" sort={sort} onSort={onSort} align="right" />
        </div>

        <ul>
          {visible.map((transaction) => {
            const credit = transaction.amount >= 0;
            const sym = extractSymbol(transaction);
            return (
              <li
                key={transaction.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-border-soft px-3 py-3 transition-colors last:border-b-0 hover:bg-panel-2 md:grid-cols-[1.1fr_0.9fr_minmax(0,2.2fr)_1.2fr_1fr_1.1fr] md:gap-3 md:py-2.5"
              >
                {/* Identity: date (desktop col 1) / type + date (mobile) */}
                <div className="min-w-0 md:col-start-1">
                  <div className="flex items-center gap-2 md:hidden">
                    <TypeBadge type={transaction.type} />
                    <span className="text-(length:--term-text-xs) tnum text-text-muted">{fmtDateTime(transaction.createdAt)}</span>
                  </div>
                  <div className="hidden md:block text-(length:--term-text-sm) tnum text-text-muted">{fmtDateTime(transaction.createdAt)}</div>
                </div>
                {/* Amount — mobile anchor; desktop col 6 */}
                <div className={`text-right text-sm font-semibold tnum md:col-start-6 ${credit ? "text-up" : "text-down"}`}>
                  {credit ? "+" : ""}{transaction.amount.toFixed(2)} <span className="text-(length:--term-text-2xs) font-normal text-text-faint">{transaction.asset}</span>
                </div>
                {/* Desktop-only columns */}
                <div className="hidden md:block md:col-start-2"><TypeBadge type={transaction.type} /></div>
                <div className="hidden md:block md:col-start-3 min-w-0">
                  <span className="flex items-center gap-1.5">
                    {sym ? <InstrumentIcon symbol={sym} size={14} /> : null}
                    {transaction.description ? (
                      <Tooltip text={transaction.description}>
                        <span className="truncate text-(length:--term-text-sm) text-text-muted">{transaction.description}</span>
                      </Tooltip>
                    ) : (
                      <span className="text-(length:--term-text-sm) text-text-muted">—</span>
                    )}
                  </span>
                </div>
                <div className="hidden md:block md:col-start-4">
                  {transaction.reference ? (
                    <Tooltip text="Copy reference">
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); void copyReference(transaction.reference!); }}
                        className="tnum text-(length:--term-text-xs) text-text-faint transition hover:text-brand"
                      >
                        {copiedRef === transaction.reference ? "✓ Copied" : transaction.reference}
                      </button>
                    </Tooltip>
                  ) : (
                    <span className="text-(length:--term-text-xs) text-text-faint">—</span>
                  )}
                </div>
                <div className="hidden md:block md:col-start-5"><StatusBadge status={transaction.status} /></div>
                {/* Mobile secondary line: status + reference */}
                <div className="col-start-1 flex items-center gap-2 md:hidden">
                  <StatusBadge status={transaction.status} />
                  {transaction.reference && (
                    <Tooltip text="Copy reference">
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); void copyReference(transaction.reference!); }}
                        className="tnum text-(length:--term-text-2xs) text-text-faint transition hover:text-brand"
                      >
                        {copiedRef === transaction.reference ? "✓ Copied" : transaction.reference}
                      </button>
                    </Tooltip>
                  )}
                  {transaction.description && (
                    <Tooltip text={transaction.description}>
                      <span className="truncate text-(length:--term-text-2xs) text-text-faint">{transaction.description}</span>
                    </Tooltip>
                  )}
                </div>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="px-4 py-8">
              <EmptyState compact icon={<Inbox size={18} />} title={hasActiveFilters ? "No transactions match the current filters." : "No transactions yet. Deposits and withdrawals will appear here."} />
            </li>
          )}
        </ul>
      </RecordShell>
    </div>
  );
}

function TypeBadge({ type }: { type: Txn["type"] }) {
  const map: Record<Txn["type"], string> = {
    DEPOSIT: "bg-(--term-success-bg) text-(--term-success-fg)", WITHDRAW: "bg-(--term-danger-bg) text-(--term-danger-fg)", BONUS: "bg-(--term-warning-bg) text-(--term-warning-fg)",
    ADJUSTMENT: "bg-panel-3 text-text-muted", COMMISSION: "bg-panel-3 text-text-muted", SWAP: "bg-panel-3 text-text-muted",
    TRADE_PNL: "bg-(--term-warning-bg) text-(--term-warning-fg)", FEE: "bg-(--term-danger-bg) text-(--term-danger-fg)", REVERSAL: "bg-panel-3 text-text-muted",
    NEGATIVE_BALANCE_PROTECTION: "bg-(--term-success-bg) text-(--term-success-fg)",
  };
  return <span className={`rounded px-1.5 py-0.5 text-(length:--term-text-2xs) ${map[type]}`}>{type}</span>;
}

function StatusBadge({ status }: { status: Txn["status"] }) {
  const map: Record<Txn["status"], string> = {
    COMPLETED: "bg-(--term-success-bg) text-(--term-success-fg)", PENDING: "bg-(--term-warning-bg) text-(--term-warning-fg)", REJECTED: "bg-(--term-danger-bg) text-(--term-danger-fg)",
    CANCELLED: "bg-panel-3 text-text-muted", REVERSED: "bg-brand/10 text-brand border border-brand/30",
  };
  return <span className={`rounded px-1.5 py-0.5 text-(length:--term-text-2xs) ${map[status]}`}>{status}</span>;
}

/**
 * Trade-related transaction descriptions always start with the instrument
 * symbol (e.g. "EURUSD opening commission", "XAUUSD manual_close realized P&L").
 * Extract it so we can show the InstrumentIcon badge. Returns null for
 * non-instrument transactions (deposits, withdrawals, bonuses).
 */
const INSTRUMENT_TXN_TYPES = new Set(["COMMISSION", "SWAP", "TRADE_PNL", "REVERSAL", "NEGATIVE_BALANCE_PROTECTION"]);
function extractSymbol(txn: Txn): string | null {
  if (!INSTRUMENT_TXN_TYPES.has(txn.type) || !txn.description) return null;
  const match = txn.description.match(/^([A-Z0-9]{2,10})\b/);
  return match ? match[1] : null;
}
