"use client";

import { useEffect, useMemo, useState } from "react";
import type { InstrumentView } from "@/lib/types";
import { Pagination } from "@/components/ui/Pagination";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";

type PositionRow = {
  id: string;
  symbol: string;
  type: "CFD" | "STRIKE";
  side: "BUY" | "SELL";
  volume: number;
  openRate: number;
  strikeRate: number | null;
  currentRate: number;
  netProfit: number;
  status: "OPEN" | "CLOSED";
  openedAt: Date;
  closedAt: Date | null;
};

interface Props {
  open: PositionRow[];
  closed: PositionRow[];
  instruments: Record<string, InstrumentView>;
}

const PAGE_SIZE = 20;

/** Paginated, mobile-safe position history for the account page. */
export function PositionHistory({ open, closed, instruments }: Props) {
  const [page, setPage] = useState(1);
  const rows = useMemo(
    () => [...open, ...closed].sort((left, right) => right.openedAt.getTime() - left.openedAt.getTime()),
    [open, closed],
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const digits = (symbol: string) => instruments[symbol]?.digits ?? 5;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-canvas">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-border bg-panel-2 px-4 py-2">
        <h3 className="text-xs font-medium uppercase text-text-muted">Position History</h3>
        <span className="text-[10px] text-text-faint">Open {open.length} · Closed {closed.length}</span>
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="min-w-[880px] w-full">
          <thead className="border-b border-border-soft bg-panel-2">
            <tr>
              <Th>Symbol</Th><Th>Type</Th><Th>Side</Th><Th className="text-right">Volume</Th>
              <Th className="text-right">Open Rate</Th><Th className="text-right">Current/Close</Th>
              <Th className="text-right">Net Profit</Th><Th>Status</Th><Th>Opened</Th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((position) => {
              const profitable = position.netProfit >= 0;
              return (
                <tr key={position.id} className="border-b border-border-soft hover:bg-panel-2">
                  <Td className="font-medium"><span className="flex items-center gap-1.5"><InstrumentIcon symbol={position.symbol} size={14} />{position.symbol}</span></Td>
                  <Td className="text-text-muted">{position.type}</Td>
                  <Td><span className={position.side === "BUY" ? "text-up" : "text-down"}>{position.side}</span></Td>
                  <Td className="text-right tnum">{position.volume.toFixed(2)}</Td>
                  <Td className="text-right tnum">{fmt(position.openRate, digits(position.symbol))}</Td>
                  <Td className="text-right tnum">{fmt(position.currentRate, digits(position.symbol))}</Td>
                  <Td className={`text-right font-medium tnum ${profitable ? "text-up" : "text-down"}`}>
                    {profitable ? "+" : ""}{position.netProfit.toFixed(2)}
                  </Td>
                  <Td>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${position.status === "OPEN" ? "bg-brand-soft text-brand" : "bg-panel-3 text-text-muted"}`}>
                      {position.status}
                    </span>
                  </Td>
                  <Td className="text-[11px] text-text-muted tnum">
                    {position.openedAt.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </Td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-xs text-text-faint">No positions yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pagination page={safePage} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={setPage} label="positions" />
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-3 py-2 text-left text-[10px] font-medium uppercase text-text-faint ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-3 py-2 text-xs ${className}`}>{children}</td>;
}
function fmt(value: number, digits: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
