"use client";

import { useEffect, useMemo, useState } from "react";
import { Pagination } from "@/components/ui/Pagination";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { TableShell, Th, Td, EmptyRow, FilterChip, TableSearch, type SortDirection } from "@/components/ui/DataTable";
import { CsvExportButton } from "@/components/ui/CsvExport";
import { StatCard } from "@/components/ui/StatCard";
import { fmtDateTime } from "@/lib/dates";

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

/** Transactions history: filters, date range, search, CSV export. */
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

      <TableShell
        minWidth={900}
        footer={<Pagination page={safePage} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={setPage} label="transactions" />}
        toolbar={
          <>
            <TableSearch value={search} onChange={setSearch} placeholder="Search description or reference…" label="Search transactions" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "ALL" | Txn["type"])}
              aria-label="Filter by type"
              className="h-8 rounded border border-border bg-canvas px-2 text-xs outline-none focus:border-brand"
            >
              <option value="ALL">All types</option>
              {[...new Set(transactions.map((t) => t.type))].sort().map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" className="h-8 rounded border border-border bg-canvas px-2 text-xs text-text-muted outline-none focus:border-brand" />
              <span className="text-[10px] text-text-faint">→</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" className="h-8 rounded border border-border bg-canvas px-2 text-xs text-text-muted outline-none focus:border-brand" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(["ALL", "COMPLETED", "PENDING", "REJECTED", "CANCELLED"] as const).map((value) => (
                <FilterChip key={value} active={statusFilter === value} onClick={() => setStatusFilter(value)}>
                  {value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase()}
                </FilterChip>
              ))}
            </div>
            <span className="ml-auto text-[10px] text-text-faint tnum">{rows.length} shown</span>
            <CsvExportButton filename="transactions" columns={["Date", "Type", "Description", "Reference", "Status", "Amount"]} rows={csvRows} disabled={rows.length === 0} />
          </>
        }
      >
        <thead className="border-b border-border-soft bg-panel-2">
          <tr>
            <Th sortKey="createdAt" sort={sort} onSort={onSort}>Date</Th>
            <Th>Type</Th>
            <Th>Description</Th>
            <Th>Reference</Th>
            <Th>Status</Th>
            <Th sortKey="amount" sort={sort} onSort={onSort} align="right">Amount</Th>
          </tr>
        </thead>
        <tbody>
          {visible.map((transaction) => {
            const credit = transaction.amount >= 0;
            const sym = extractSymbol(transaction);
            return (
              <tr key={transaction.id} className="border-b border-border-soft last:border-b-0 hover:bg-panel-2">
                <Td className="text-text-muted">{fmtDateTime(transaction.createdAt)}</Td>
                <Td><TypeBadge type={transaction.type} /></Td>
                <Td className="max-w-64">
                  <span className="flex items-center gap-1.5">
                    {sym ? <InstrumentIcon symbol={sym} size={14} /> : null}
                    <span className="truncate text-text-muted" title={transaction.description ?? undefined}>
                      {transaction.description ?? "—"}
                    </span>
                  </span>
                </Td>
                <Td>
                  {transaction.reference ? (
                    <button
                      type="button"
                      onClick={() => void copyReference(transaction.reference!)}
                      title="Copy reference"
                      className="tnum text-text-faint transition hover:text-brand"
                    >
                      {copiedRef === transaction.reference ? "✓ Copied" : transaction.reference}
                    </button>
                  ) : (
                    <span className="text-text-faint">—</span>
                  )}
                </Td>
                <Td><StatusBadge status={transaction.status} /></Td>
                <Td align="right" className={credit ? "text-up" : "text-down"}>
                  <span className={`font-medium ${credit ? "text-up" : "text-down"}`}>
                    {credit ? "+" : ""}{transaction.amount.toFixed(2)} {transaction.asset}
                  </span>
                </Td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <EmptyRow
              colSpan={6}
              label={hasActiveFilters ? "No transactions match the current filters." : "No transactions yet. Deposits and withdrawals will appear here."}
            />
          )}
        </tbody>
      </TableShell>
    </div>
  );
}

function TypeBadge({ type }: { type: Txn["type"] }) {
  const map: Record<Txn["type"], string> = {
    DEPOSIT: "bg-up/10 text-up", WITHDRAW: "bg-down/10 text-down", BONUS: "bg-brand-soft text-brand",
    ADJUSTMENT: "bg-panel-3 text-text-muted", COMMISSION: "bg-panel-3 text-text-muted", SWAP: "bg-panel-3 text-text-muted",
    TRADE_PNL: "bg-brand-soft text-brand", FEE: "bg-down/10 text-down", REVERSAL: "bg-panel-3 text-text-muted",
    NEGATIVE_BALANCE_PROTECTION: "bg-up/10 text-up",
  };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] ${map[type]}`}>{type}</span>;
}

function StatusBadge({ status }: { status: Txn["status"] }) {
  const map: Record<Txn["status"], string> = {
    COMPLETED: "bg-up/10 text-up", PENDING: "bg-brand-soft text-brand", REJECTED: "bg-down/10 text-down",
    CANCELLED: "bg-panel-3 text-text-muted", REVERSED: "bg-brand/10 text-brand border border-brand/30",
  };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] ${map[status]}`}>{status}</span>;
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
