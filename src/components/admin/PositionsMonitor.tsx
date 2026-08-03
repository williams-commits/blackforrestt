"use client";

interface PositionRow {
  id: string; symbol: string; type: "CFD" | "STRIKE"; side: "BUY" | "SELL";
  volume: number; openRate: number; currentRate: number; netProfit: number;
  openedAt: string; user: { email: string | null; name: string | null; accountNo: string | null };
}

/** Admin positions monitor: all users' open positions with P/L. */
export function PositionsMonitor({ positions }: { positions: PositionRow[] }) {
  const totalFloating = positions.reduce((s, p) => s + p.netProfit, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-muted">{positions.length} open positions across all accounts</span>
        <span className={`text-sm font-semibold tnum ${totalFloating >= 0 ? "text-up" : "text-down"}`}>
          Total floating P/L: {totalFloating >= 0 ? "+" : ""}${totalFloating.toFixed(2)}
        </span>
      </div>

      <div className="bg-canvas border border-border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-panel-2 border-b border-border">
            <tr>
              <Th>Trader</Th>
              <Th>Symbol</Th>
              <Th>Side</Th>
              <Th className="text-right">Volume</Th>
              <Th className="text-right">Open</Th>
              <Th className="text-right">Current</Th>
              <Th className="text-right">Net P/L</Th>
              <Th>Opened</Th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.id} className="border-t border-border-soft hover:bg-panel-2">
                <Td>
                  <div className="font-medium">{p.user.name ?? p.user.email ?? "—"}</div>
                  <div className="text-[11px] text-text-faint">#{p.user.accountNo ?? "—"}</div>
                </Td>
                <Td className="font-medium">{p.symbol}</Td>
                <Td><span className={p.side === "BUY" ? "text-up" : "text-down"}>{p.side}</span></Td>
                <Td className="text-right tnum">{p.volume.toFixed(2)}</Td>
                <Td className="text-right tnum">{p.openRate.toFixed(5)}</Td>
                <Td className="text-right tnum">{p.currentRate.toFixed(5)}</Td>
                <Td className={`text-right tnum font-medium ${p.netProfit >= 0 ? "text-up" : "text-down"}`}>
                  {p.netProfit >= 0 ? "+" : ""}{p.netProfit.toFixed(2)}
                </Td>
                <Td className="text-text-muted tnum text-[11px]">
                  {new Date(p.openedAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
                </Td>
              </tr>
            ))}
            {positions.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-text-faint text-xs">No open positions.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left font-medium text-text-faint text-[10px] uppercase px-3 py-2 whitespace-nowrap ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-xs whitespace-nowrap ${className}`}>{children}</td>;
}
