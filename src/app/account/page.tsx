import Link from "next/link";
import { prisma, resolveUserId } from "@/server/db";
import { auth } from "@/auth";
import { Logo } from "@/components/trade/Logo";
import { AccountShell } from "@/components/account/AccountShell";
import { AccountUserMenu } from "@/components/account/AccountUserMenu";
import type { InstrumentView } from "@/lib/types";
import { ADDRESS_DOCUMENT_TYPES, IDENTITY_DOCUMENT_TYPES } from "@/lib/kyc";
import { resolveUserSettings } from "@/server/userSettings";

export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your account, positions, transactions, payments and verification.",
  robots: { index: false, follow: false },
}


const VALID_TABS = ["overview", "positions", "transactions", "payments", "reports", "verification", "support", "referrals", "settings"] as const;

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const initialTab = tab && (VALID_TABS as readonly string[]).includes(tab) ? tab : undefined;

  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);

  const [
    user,
    metrics,
    openPositions,
    closedPositions,
    wallets,
    transactions,
    kyc,
    activeBlocks,
    openCaseCount,
    criticalCaseCount,
    latestReconciliationRun,
    paymentMismatchCount,
    cleanKycDocuments,
    cleanIdentityDocuments,
    cleanAddressDocuments,
    pendingKycDocuments,
    blockedKycDocuments,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true, accountNo: true, createdAt: true, verified: true },
    }),
    prisma.accountMetrics.findUnique({
      where: { userId },
    }),
    prisma.position.findMany({ where: { userId, status: "OPEN" }, orderBy: { openedAt: "desc" }, take: 50 }),
    prisma.position.findMany({ where: { userId, status: "CLOSED" }, orderBy: { closedAt: "desc" }, take: 50 }),
    prisma.wallet.findMany({ where: { userId } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.kycSubmission.findUnique({ where: { userId } }),
    prisma.reconciliationBlock.findMany({
      where: { userId, releasedAt: null },
      select: { scope: true, reason: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.reconciliationCase.count({
      where: { userId, status: { not: "RESOLVED" } },
    }),
    prisma.reconciliationCase.count({
      where: { userId, status: { not: "RESOLVED" }, severity: "CRITICAL" },
    }),
    prisma.reconciliationRun.findFirst({
      select: { reference: true, status: true, completedAt: true },
      orderBy: { startedAt: "desc" },
    }),
    prisma.paymentRequest.count({ where: { userId, reconciliationStatus: "MISMATCHED" } }),
    prisma.kycDocument.count({ where: { userId, deletedAt: null, status: "CLEAN" } }),
    prisma.kycDocument.count({
      where: { userId, deletedAt: null, status: "CLEAN", docType: { in: IDENTITY_DOCUMENT_TYPES.map((item) => item.value) } },
    }),
    prisma.kycDocument.count({
      where: { userId, deletedAt: null, status: "CLEAN", docType: { in: ADDRESS_DOCUMENT_TYPES.map((item) => item.value) } },
    }),
    prisma.kycDocument.count({ where: { userId, deletedAt: null, status: "PENDING_SCAN" } }),
    prisma.kycDocument.count({ where: { userId, deletedAt: null, status: { in: ["BLOCKED", "QUARANTINED"] } } }),
  ]);

  // Instrument metadata for digit formatting.
  const symbols = Array.from(new Set([...openPositions, ...closedPositions].map((p) => p.symbol)));
  const instruments = await prisma.instrument.findMany({ where: { symbol: { in: symbols } } });
  const instrumentMap: Record<string, InstrumentView> = {};
  for (const i of instruments) {
    instrumentMap[i.symbol] = {
      symbol: i.symbol,
      name: i.name,
      category: i.category,
      base: i.base,
      quote: i.quote,
      digits: i.digits,
      pipSize: Number(i.pipSize),
      pipValue: Number(i.pipValue),
      contractSize: Number(i.contractSize),
      marginPerLot: Number(i.marginPerLot),
      commissionPerLot: Number(i.commissionPerLot),
      bid: Number(i.basePrice),
      ask: Number(i.basePrice),
      mid: Number(i.basePrice),
      changePct: 0,
    };
  }

  // Resolve per-user settings.
  const settings = await resolveUserSettings(userId);

  return (
    <div className="min-h-screen bg-panel">
      <header className="sticky top-0 z-20 flex min-h-12 flex-wrap items-center gap-3 border-b border-border bg-canvas px-3 py-1 sm:flex-nowrap sm:px-4">
        <Logo />
        <nav className="order-3 w-full items-center gap-4 overflow-x-auto text-xs sm:order-0 hidden lg:flex">
          <Link href="/trade/AUDCAD" className="text-text-muted hover:text-text">Trade</Link>
          <span className="text-text font-medium">Account</span>
          <Link href="/reports" className="text-text-muted hover:text-text">Reports</Link>
        </nav>
        <AccountUserMenu
          displayName={user.name ?? user.email ?? "Trader"}
          email={user.email ?? ""}
          accountNo={user.accountNo}
          isAdmin={session?.user?.role === "admin"}
        />
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <AccountShell
          initialTab={initialTab as "overview" | "positions" | "transactions" | "payments" | "reports" | "verification" | "support" | "settings" | undefined}
          user={{
            id: user.id,
            name: user.name ?? user.email ?? "Trader",
            email: user.email ?? "",
            accountNo: user.accountNo ?? "—",
            createdAt: user.createdAt.toISOString(),
            verified: user.verified,
          }}
          metrics={{
            balance: Number(metrics?.balance ?? 0),
            credit: Number(metrics?.credit ?? 0),
            equity: Number(metrics?.equity ?? 0),
            margin: Number(metrics?.margin ?? 0),
            marginLevel: metrics?.marginLevel != null ? Number(metrics.marginLevel) : null,
            free: Number(metrics?.free ?? 0),
            floatingPl: Number(metrics?.floatingPl ?? 0),
          }}
          wallets={wallets.map((w) => ({ asset: w.asset, free: Number(w.free), locked: Number(w.locked) }))}
          openCount={openPositions.length}
          positions={[...openPositions, ...closedPositions].map((p) => ({
            id: p.id,
            symbol: p.symbol,
            type: p.type,
            side: p.side,
            volume: Number(p.volume),
            openRate: Number(p.openRate),
            strikeRate: p.strikeRate != null ? Number(p.strikeRate) : null,
            currentRate: Number(p.currentRate),
            netProfit: Number(p.netProfit),
            swap: Number(p.swap),
            commission: Number(p.commission),
            tradingCommission: Number(p.tradingCommission),
            status: p.status,
            openedAt: p.openedAt.toISOString(),
            closedAt: p.closedAt?.toISOString() ?? null,
          }))}
          transactions={transactions.map((t) => ({
            id: t.id,
            type: t.type,
            status: t.status,
            amount: Number(t.amount),
            asset: t.asset,
            description: t.description,
            reference: t.reference,
            createdAt: t.createdAt.toISOString(),
          }))}
          kyc={kyc ? {
            status: kyc.status,
            firstName: kyc.firstName,
            lastName: kyc.lastName,
            docType: kyc.docType,
            note: kyc.note,
            submittedAt: kyc.submittedAt?.toISOString() ?? null,
            reviewedAt: kyc.reviewedAt?.toISOString() ?? null,
          } : null}
          instruments={instrumentMap}
          depositUiEnabled={settings.deposits.uiEnabled}
          disabledPaymentMethods={["CARD", "BANK_TRANSFER", "CRYPTO"].filter(
            (m) => !settings.deposits.allowedMethods.includes(m),
          )}
          reconciliation={{
            activeBlocks: activeBlocks.map((block) => ({ ...block, createdAt: block.createdAt.toISOString() })),
            openCaseCount,
            criticalCaseCount,
            paymentMismatchCount,
            lastRun: latestReconciliationRun ? {
              reference: latestReconciliationRun.reference,
              status: latestReconciliationRun.status,
              completedAt: latestReconciliationRun.completedAt?.toISOString() ?? null,
            } : null,
          }}
          kycChecklist={{
            cleanDocuments: cleanKycDocuments,
            cleanIdentityDocuments,
            cleanAddressDocuments,
            pendingDocuments: pendingKycDocuments,
            blockedDocuments: blockedKycDocuments,
          }}
        />
      </main>
    </div>
  );
}
