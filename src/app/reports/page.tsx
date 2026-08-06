import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma, resolveUserId } from "@/server/db";
import { auth } from "@/auth";
import { Logo } from "@/components/trade/Logo";
import { AccountUserMenu } from "@/components/account/AccountUserMenu";
import {
  ReportsView,
  type ReportRow,
  type ReportSummary,
} from "@/components/account/ReportsView";

export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports",
  description: "Account statements, trading history and tax reports.",
  robots: { index: false, follow: false },
}


const PAGE_SIZE = 50;
const SYMBOL_PATTERN = /^[A-Z0-9._-]{2,20}$/;

type ReportsPageProps = {
  searchParams: Promise<{
    page?: string | string[];
    symbol?: string | string[];
    side?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function parseSymbol(value: string | undefined): string {
  const normalized = value?.trim().toUpperCase();
  return normalized && SYMBOL_PATTERN.test(normalized) ? normalized : "ALL";
}

function parseSide(value: string | undefined): "ALL" | "BUY" | "SELL" {
  const normalized = value?.trim().toUpperCase();
  return normalized === "BUY" || normalized === "SELL" ? normalized : "ALL";
}

function toReportRow(position: {
  id: string;
  symbol: string;
  type: "CFD" | "STRIKE";
  side: "BUY" | "SELL";
  volume: Prisma.Decimal;
  netProfit: Prisma.Decimal;
  swap: Prisma.Decimal;
  commission: Prisma.Decimal;
  tradingCommission: Prisma.Decimal;
  openedAt: Date;
  closedAt: Date | null;
}): ReportRow {
  return {
    id: position.id,
    symbol: position.symbol,
    type: position.type,
    side: position.side,
    volume: Number(position.volume),
    netProfit: Number(position.netProfit),
    swap: Number(position.swap),
    commission: Number(position.commission) + Number(position.tradingCommission),
    openedAt: position.openedAt.toISOString(),
    closedAt: (position.closedAt ?? position.openedAt).toISOString(),
  };
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const params = await searchParams;
  const requestedPage = parsePage(firstParam(params.page));
  const symbol = parseSymbol(firstParam(params.symbol));
  const side = parseSide(firstParam(params.side));

  const where: Prisma.PositionWhereInput = {
    userId,
    status: "CLOSED",
    ...(symbol !== "ALL" ? { symbol } : {}),
    ...(side !== "ALL" ? { side } : {}),
  };

  const [user, total, symbolRows] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true, accountNo: true },
    }),
    prisma.position.count({ where }),
    prisma.position.findMany({
      where: { userId, status: "CLOSED" },
      select: { symbol: true },
      distinct: ["symbol"],
      orderBy: { symbol: "asc" },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const winningWhere: Prisma.PositionWhereInput = { ...where, netProfit: { gt: 0 } };
  const losingWhere: Prisma.PositionWhereInput = { ...where, netProfit: { lt: 0 } };

  const [positions, totals, winningCount, winningTotals, losingTotals, bestPosition, worstPosition] = await Promise.all([
    prisma.position.findMany({
      where,
      orderBy: [{ closedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.position.aggregate({
      where,
      _sum: {
        netProfit: true,
        swap: true,
        commission: true,
        tradingCommission: true,
      },
    }),
    prisma.position.count({ where: winningWhere }),
    prisma.position.aggregate({ where: winningWhere, _sum: { netProfit: true } }),
    prisma.position.aggregate({ where: losingWhere, _sum: { netProfit: true } }),
    prisma.position.findFirst({ where, orderBy: [{ netProfit: "desc" }, { closedAt: "desc" }] }),
    prisma.position.findFirst({ where, orderBy: [{ netProfit: "asc" }, { closedAt: "desc" }] }),
  ]);

  const grossWin = Number(winningTotals._sum.netProfit ?? 0);
  const grossLoss = Math.abs(Number(losingTotals._sum.netProfit ?? 0));
  const summary: ReportSummary = {
    net: Number(totals._sum.netProfit ?? 0),
    winRate: total > 0 ? (winningCount / total) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? null : 0,
    totalSwap: Number(totals._sum.swap ?? 0),
    totalComm:
      Number(totals._sum.commission ?? 0) +
      Number(totals._sum.tradingCommission ?? 0),
    trades: total,
    best: bestPosition ? toReportRow(bestPosition) : null,
    worst: worstPosition ? toReportRow(worstPosition) : null,
  };

  return (
    <div className="min-h-screen bg-panel">
      <header className="sticky top-0 z-20 flex h-12 items-center gap-4 border-b border-border bg-canvas px-4">
        <Logo />
        <nav className="flex items-center gap-4 text-xs">
          <Link href="/trade/AUDCAD" className="text-text-muted hover:text-text">Trade</Link>
          <Link href="/account" className="text-text-muted hover:text-text">Account</Link>
          <span className="font-medium text-text">Reports</span>
        </nav>
        <AccountUserMenu
          displayName={user.name ?? user.email ?? "Trader"}
          email={user.email ?? ""}
          accountNo={user.accountNo}
          isAdmin={session?.user?.role === "admin"}
        />
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-lg font-semibold">Trade Reports</h1>
        <ReportsView
          rows={positions.map(toReportRow)}
          server={{
            summary,
            symbols: symbolRows.map((row) => row.symbol),
            filters: { symbol, side },
            pagination: { page, pageCount, total, pageSize: PAGE_SIZE },
          }}
        />
      </main>
    </div>
  );
}
