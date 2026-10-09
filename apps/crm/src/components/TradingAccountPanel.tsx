"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformPresenceBadge } from "@/components/PlatformPresenceBadge";
import { PlatformLinkPanel, PlatformUnlinkButton } from "@/components/PlatformLinkPanel";
import { Table, THead, TBody, TR, TH, TD } from "@/components/table";
import { apiGet } from "@/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Customer 360 — the CRM's live window into a linked customer's trading
 * context. Rides the scoped `/api/customers/[id]/trading-context` route
 * (which reads the read-only platform bridge), so this component never
 * touches platform data directly. All states are honest: skeletons while
 * loading, "unavailable" when the platform is down, "not linked" when no
 * platform user is attached — never a fabricated offline/zero.
 */

interface AccountBlock {
  accountNo: string | null;
  balance: number;
  equity: number;
  free: number;
  margin: number;
  marginLevel: number | null;
  floatingPl: number;
}

interface TradingContext {
  version: number;
  account: AccountBlock | null;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    registeredAt: string;
    state: string;
    emailVerified: boolean;
  };
  kyc: { status: string; submittedAt: string | null; reviewedAt: string | null } | null;
  wallets: Array<{ asset: string; free: string; locked: string }>;
  payments: Array<{ id: string; type: string; status: string; amount: string; asset: string; createdAt: string }>;
  openPositions: number;
  presence: { online: boolean };
  positions: Array<{
    id: string;
    symbol: string;
    side: string;
    type: string;
    volume: string;
    openRate: string;
    currentRate: string;
    netProfit: string;
    openedAt: string;
  }>;
}

type TradingContextResponse =
  | { linked: false }
  | { linked: true; available: false }
  | { linked: true; available: true; context: TradingContext; fetchedAt: string };

/** Shared query: one fetch serves both the summary card and the platform
 *  tab. Fresh for 30s, auto-refetched every 60s (presence/positions drift),
 *  keeps previous data while refetching so the UI never flashes. */
export function useTradingContext(customerId: string) {
  return useQuery({
    queryKey: queryKeys.tradingContext(customerId),
    queryFn: () => apiGet<{ data: TradingContextResponse }>(`/api/customers/${customerId}/trading-context`).then((body) => body.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
}

function usd(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** ── Compact summary — the restrained right-rail card. ─────────────────── */

export function TradingAccountCard({ customerId, tradeUrl }: { customerId: string; tradeUrl: string | null }) {
  const { data, isPending } = useTradingContext(customerId);

  if (isPending || !data?.linked) return null; // restrained: nothing until there's something to say
  if (!data.available) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden><Icon name="plug" size={13} /></span>
            Trading account
          </h2>
        </div>
        <div className="card-body">
          <p className="text-[13px]" style={{ color: "var(--warning)" }}>Linked, but the trading platform is unavailable right now.</p>
        </div>
      </div>
    );
  }

  const { context } = data;
  const stateColor = context.user.state === "ACTIVE" ? "var(--success)" : "var(--error)";
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden><Icon name="plug" size={13} /></span>
          Trading account
        </h2>
      </div>
      <div className="card-body space-y-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Equity</span>
          <span className="text-lg font-semibold tabular-nums">
            {context.account ? `$${usd(context.account.equity)}` : "—"}
          </span>
        </div>
        <dl className="space-y-1.5 text-[12px]">
          <div className="flex items-baseline justify-between gap-2">
            <dt style={{ color: "var(--text-secondary)" }}>Status</dt>
            <dd className="flex items-center gap-2 font-medium">
              <span style={{ color: stateColor }}>{context.user.state.toLowerCase()}</span>
              <PlatformPresenceBadge customerId={customerId} initialOnline={context.presence.online} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt style={{ color: "var(--text-secondary)" }}>Account</dt>
            <dd className="font-medium tabular-nums">{context.account?.accountNo ?? "—"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt style={{ color: "var(--text-secondary)" }}>Open positions</dt>
            <dd className="font-medium tabular-nums">{context.openPositions}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt style={{ color: "var(--text-secondary)" }}>KYC</dt>
            <dd className="font-medium">{context.kyc?.status.replaceAll("_", " ").toLowerCase() ?? "not submitted"}</dd>
          </div>
        </dl>
        {tradeUrl ? (
          <a
            href={tradeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 pt-1 text-xs font-medium hover:underline"
            style={{ color: "var(--text-brand)" }}
          >
            Open trading account <Icon name="external" size={12} />
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** ── Full detail — the Platform tab body. ──────────────────────────────── */

export function TradingAccountDetails({
  customerId,
  customerEmail,
  canEdit,
}: {
  customerId: string;
  customerEmail: string | null;
  canEdit: boolean;
}) {
  const { data, isPending, isError, refetch } = useTradingContext(customerId);

  if (isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-3" style={{ background: "var(--bg-subtle)" }}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-4 w-28" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!data?.linked) {
    return <PlatformLinkPanel customerId={customerId} customerEmail={customerEmail} canEdit={canEdit} />;
  }

  if (!data.available || isError) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: "var(--warning)" }}>
          Linked, but the platform bridge is unavailable right now — refresh later.
        </p>
        <button type="button" onClick={() => void refetch()} className="text-xs font-medium hover:underline" style={{ color: "var(--text-brand)" }}>
          Retry
        </button>
      </div>
    );
  }

  const { context, fetchedAt } = data;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Account</p>
        <p className="mt-1 text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{context.user.name ?? context.user.email ?? "—"}</p>
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{context.user.email}</p>
        <p className="mt-1 text-[11px]">
          <span style={{ color: context.user.state === "ACTIVE" ? "var(--success)" : "var(--error)" }}>
            {context.user.state.toLowerCase()}
          </span>
          <span style={{ color: "var(--text-tertiary)" }}> · registered {new Date(context.user.registeredAt).toLocaleDateString()}</span>
        </p>
        <p className="mt-1 text-[11px]">
          <PlatformPresenceBadge customerId={customerId} initialOnline={context.presence.online} />
        </p>
      </div>
      <div className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>KYC</p>
        <p className="mt-1 text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
          {context.kyc?.status.replaceAll("_", " ").toLowerCase() ?? "not submitted"}
        </p>
        {context.kyc?.submittedAt ? (
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            submitted {new Date(context.kyc.submittedAt).toLocaleDateString()}
          </p>
        ) : null}
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>{context.openPositions} open position(s)</p>
      </div>
      <div className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Trading metrics</p>
        {context.account ? (
        <dl className="mt-1 space-y-0.5 text-[11px]">
          <div className="flex justify-between gap-2"><dt style={{ color: "var(--text-secondary)" }}>Account</dt><dd className="tabular-nums font-medium">{context.account.accountNo ?? "—"}</dd></div>
          <div className="flex justify-between gap-2"><dt style={{ color: "var(--text-secondary)" }}>Balance</dt><dd className="tabular-nums font-medium">${usd(context.account.balance)}</dd></div>
          <div className="flex justify-between gap-2"><dt style={{ color: "var(--text-secondary)" }}>Equity</dt><dd className="tabular-nums font-medium">${usd(context.account.equity)}</dd></div>
          <div className="flex justify-between gap-2"><dt style={{ color: "var(--text-secondary)" }}>Free margin</dt><dd className="tabular-nums font-medium">${usd(context.account.free)}</dd></div>
          <div className="flex justify-between gap-2"><dt style={{ color: "var(--text-secondary)" }}>Margin</dt><dd className="tabular-nums font-medium">${usd(context.account.margin)}</dd></div>
          <div className="flex justify-between gap-2">
            <dt style={{ color: "var(--text-secondary)" }}>Floating P/L</dt>
            <dd className="tabular-nums font-medium" style={{ color: context.account.floatingPl >= 0 ? "var(--success)" : "var(--error)" }}>
              {context.account.floatingPl >= 0 ? "+" : ""}${usd(context.account.floatingPl)}
            </dd>
          </div>
        </dl>
        ) : (
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-tertiary)" }}>Account metrics unavailable (engine idle).</p>
        )}
      </div>
      {context.positions.length > 0 ? (
        <div className="sm:col-span-3">
          <div className="mb-1 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Live positions</p><span className="badge badge-success">{context.positions.length} open</span></div>
          <div className="overflow-x-auto"><Table><THead><TR><TH>Symbol</TH><TH>Side</TH><TH>Volume</TH><TH>Open</TH><TH>Mark</TH><TH>Net P/L</TH></TR></THead><TBody>{context.positions.map((position) => <TR key={position.id}><TD className="font-medium">{position.symbol}</TD><TD><span className={`badge ${position.side === "BUY" ? "badge-success" : "badge-error"}`}>{position.side}</span></TD><TD>{position.volume}</TD><TD>{position.openRate}</TD><TD>{position.currentRate}</TD><TD className={Number(position.netProfit) >= 0 ? "text-(--success)" : "text-(--error)"}>{Number(position.netProfit).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TD></TR>)}</TBody></Table></div>
        </div>
      ) : null}
      <div className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Wallets</p>
        {context.wallets.length === 0 ? (
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-tertiary)" }}>No wallets.</p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-[13px]">
            {context.wallets.map((wallet) => (
              <li key={wallet.asset} className="flex justify-between">
                <span>{wallet.asset}</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {Number(wallet.free).toLocaleString()} free
                  {Number(wallet.locked) > 0 ? ` · ${Number(wallet.locked).toLocaleString()} locked` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {context.payments.length > 0 ? (
        <div className="sm:col-span-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Recent payments</p>
          <Table>
            <TBody>
              {context.payments.map((payment) => (
                <TR key={payment.id}>
                  <TD>{new Date(payment.createdAt).toLocaleDateString()}</TD>
                  <TD>{payment.type.toLowerCase()}</TD>
                  <TD>{Number(payment.amount).toLocaleString()} {payment.asset}</TD>
                  <TD style={{ color: "var(--text-secondary)" }}>{payment.status.toLowerCase()}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      ) : null}
      <p className="sm:col-span-3 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
        Updated {new Date(fetchedAt).toLocaleTimeString()} · refreshes automatically
      </p>
    </div>
  );
}

/** Unlink control for the Platform tab header (kept next to the data it removes). */
export { PlatformUnlinkButton };
