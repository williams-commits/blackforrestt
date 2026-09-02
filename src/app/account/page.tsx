import Link from "next/link";
import { prisma, resolveUserId } from "@/server/db";
import { auth } from "@/auth";
import { Logo } from "@/components/trade/Logo";
import { AccountShell } from "@/components/account/AccountShell";
import { AccountUserMenu } from "@/components/account/AccountUserMenu";
import type { InstrumentView } from "@/lib/types";
import { ADDRESS_DOCUMENT_TYPES, IDENTITY_DOCUMENT_TYPES } from "@/lib/kyc";
import { resolveUserSettings } from "@/server/userSettings";
import { adminMessageThreads, countUnreadDirectMessages } from "@/server/adminUserManagement";
import { CandlestickChart, User,  FileText} from "lucide-react";

export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your account, positions, transactions, payments and verification.",
  robots: { index: false, follow: false },
}


const VALID_TABS = ["overview", "positions", "transactions", "payments", "reports", "verification", "notifications", "messages", "support", "referrals", "settings"] as const;

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

  // Unread/attn badge counts for the account tabs — the toast layer no longer
  // consumes unread state, so these guide users to the right tab after a toast.
  // Operators see the SUPPORT INBOX unread count (customer→team) on their
  // Messages tab; customers see their own operator→me unread count.
  const isOperator = session?.user?.role === "admin";
  const [unreadNotifications, customerUnread, teamUnread, openSupportCases] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    countUnreadDirectMessages(userId),
    adminMessageThreads(),
    prisma.supportCase.count({ where: { userId, status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] } } }),
  ]);
  const unreadMessages = isOperator ? teamUnread.totalUnread : customerUnread;

  return (
    <div className="min-h-screen bg-panel">
      <header className="sticky top-0 z-20 flex min-h-12 flex-wrap items-center gap-3 border-b border-border bg-canvas px-3 py-1 sm:flex-nowrap sm:px-4">
        <Logo />
        {/* Visible on every breakpoint — previously hidden below lg, which left
            phones with no way to reach Trade/Reports from the account portal. */}
        <nav className="order-3 hidden lg:flex w-full items-center gap-4 overflow-x-auto text-xs sm:order-0 sm:w-auto">
          <Link href="/trade/AUDCAD" className="flex items-center gap-1 text-text-muted hover:text-text shadow-lg transition-colors">
          {TradeTerminal()} Trade Terminal</Link>
          <Link href="/account" className="flex items-center gap-1 whitespace-nowrap text-text-muted hover:text-text font-bold">{AccountIcon()} Account</Link>
          <Link href="/reports" className="flex items-center gap-1 whitespace-nowrap text-text-muted hover:text-text">{ReportsIcon()} Reports</Link>
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
          unreadNotifications={unreadNotifications}
          operator={isOperator}
          unreadMessages={unreadMessages}
          openSupportCases={openSupportCases}
          marginWarningPercent={settings.trading.marginWarningPercent}
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
          walletAddresses={settings.deposits.walletAddresses}
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

const ic = "w-3.5 h-3.5";

function TradeTerminal() {
  return (
    <span className="flex items-center bg-border rounded-md p-1 gap-1 text-[10px] font-semibold text-text-muted hover:text-text transition-colors">
      <CandlestickChart size={14} strokeWidth={1.75} aria-hidden className={ic} />
    </span>
  );
}

function AccountIcon() {
  return ( 
    <span className="flex items-center bg-border rounded-md p-1 gap-1 text-[10px] font-semibold text-text-muted hover:text-text transition-colors">
      <User size={14} strokeWidth={1.75} aria-hidden />
    </span>
  );
}
function ReportsIcon() {
  return ( 
    <span className="flex items-center bg-border rounded-md p-1 gap-1 text-[10px] font-semibold text-text-muted hover:text-text transition-colors">
      <FileText size={14} strokeWidth={1.75} aria-hidden />
    </span>
  );
}