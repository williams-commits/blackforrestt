"use client";

import { useEffect, useState } from "react";
import { Pagination } from "@/components/ui/Pagination";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";

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

/** Transactions history table with bounded pagination. */
export function TransactionsTab({ transactions }: { transactions: Txn[] }) {
  const [page, setPage] = useState(1);
  const totals = transactions.reduce(
    (acc, transaction) => {
      if (transaction.status === "COMPLETED") acc.net += transaction.amount;
      return acc;
    },
    { net: 0 },
  );
  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = transactions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => setPage(1), [transactions]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <SummaryCard label="Total Movements" value={transactions.length.toString()} />
        <SummaryCard label="Net" value={`${totals.net >= 0 ? "+" : ""}${totals.net.toFixed(2)}`} valueClass={totals.net >= 0 ? "text-up" : "text-down"} />
        <SummaryCard label="Currency" value="USD" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-canvas">
        <div className="overflow-x-auto">
          <table className="w-full min-w-180">
            <thead className="border-b border-border-soft bg-panel-2">
              <tr>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Description</Th>
                <Th>Reference</Th>
                <Th>Status</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((transaction) => {
                const credit = transaction.amount >= 0;
                return (
                  <tr key={transaction.id} className="border-b border-border-soft hover:bg-panel-2">
                    <Td className="text-text-muted tnum">{fmtDate(transaction.createdAt)}</Td>
                    <Td><TypeBadge type={transaction.type} /></Td>
                    <Td className="max-w-64">
                      <span className="flex items-center gap-1.5">
                        {(() => {
                          const sym = extractSymbol(transaction);
                          return sym ? <InstrumentIcon symbol={sym} size={14} /> : null;
                        })()}
                        <span className="truncate text-text-muted" title={transaction.description ?? undefined}>
                          {transaction.description ?? "—"}
                        </span>
                      </span>
                    </Td>
                    <Td className="text-text-faint tnum">{transaction.reference ?? "—"}</Td>
                    <Td><StatusBadge status={transaction.status} /></Td>
                    <Td className={`text-right font-medium tnum ${credit ? "text-up" : "text-down"}`}>
                      {credit ? "+" : ""}{transaction.amount.toFixed(2)} {transaction.asset}
                    </Td>
                  </tr>
                );
              })}
              {transactions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-text-faint">No transactions yet. Deposits and withdrawals will appear here.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pagination page={safePage} pageSize={PAGE_SIZE} totalItems={transactions.length} onPageChange={setPage} label="transactions" />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return <div className="rounded-lg border border-border bg-canvas p-4"><div className="text-[11px] uppercase text-text-faint">{label}</div><div className={`mt-1 text-lg font-semibold tnum ${valueClass}`}>{value}</div></div>;
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
    CANCELLED: "bg-panel-3 text-text-muted", REVERSED: "bg-brand-soft text-brand",
  };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] ${map[status]}`}>{status}</span>;
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-3 py-2 text-left text-[10px] font-medium uppercase text-text-faint ${className}`}>{children}</th>;
}
function Td({ children, className = "", title }: { children?: React.ReactNode; className?: string; title?: string }) {
  return <td title={title} className={`whitespace-nowrap px-3 py-2 text-xs ${className}`}>{children}</td>;
}
function fmtDate(value: string): string {
  return new Date(value).toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
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
