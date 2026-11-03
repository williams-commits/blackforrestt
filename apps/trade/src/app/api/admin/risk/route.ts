import { NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin("RISK_READ");
    const [rules, criticalBlocks, marginAlerts] = await Promise.all([
      prisma.riskRule.findMany({ orderBy: [{ severity: "desc" }, { code: "asc" }] }),
      prisma.reconciliationBlock.count({ where: { releasedAt: null } }),
      prisma.accountMetrics.count({ where: { marginLevel: { lt: 125, gt: 0 } } }),
    ]);
    return NextResponse.json({
      rules: rules.map((rule) => ({ ...rule, createdAt: rule.createdAt.toISOString(), updatedAt: rule.updatedAt.toISOString() })),
      exposure: { activeReconciliationBlocks: criticalBlocks, accountsBelowWarningMarginLevel: marginAlerts },
      mutationPolicy: "Submit risk rule changes through Approvals. A different authorized reviewer must approve them before they take effect.",
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to load risk controls." : (error as Error).message }, { status });
  }
}
