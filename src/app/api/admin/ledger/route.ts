import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  userId: z.string().trim().min(10).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export async function GET(request: Request) {
  try {
    await requireAdmin("LEDGER_READ");
    const params = new URL(request.url).searchParams;
    const parsed = Query.safeParse({ userId: params.get("userId") ?? undefined, limit: params.get("limit") ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: "Invalid ledger query." }, { status: 400 });
    const [transactions, trial] = await Promise.all([
      prisma.ledgerTransaction.findMany({
        where: { userId: parsed.data.userId },
        orderBy: { effectiveAt: "desc" },
        take: parsed.data.limit,
        include: {
          user: { select: { email: true, accountNo: true } },
          entries: { include: { account: { select: { code: true, name: true, type: true } } } },
        },
      }),
      prisma.ledgerEntry.groupBy({
        by: ["asset", "direction"],
        _sum: { amount: true },
      }),
    ]);
    return NextResponse.json({
      trialBalance: trial.map((row) => ({ asset: row.asset, direction: row.direction, amount: row._sum.amount?.toFixed(8) ?? "0.00000000" })),
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        reference: transaction.reference,
        kind: transaction.kind,
        status: transaction.status,
        description: transaction.description,
        userId: transaction.userId,
        user: transaction.user,
        sourceType: transaction.sourceType,
        sourceId: transaction.sourceId,
        effectiveAt: transaction.effectiveAt.toISOString(),
        entries: transaction.entries.map((entry) => ({
          id: entry.id,
          direction: entry.direction,
          amount: entry.amount.toFixed(8),
          asset: entry.asset,
          account: entry.account,
        })),
      })),
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to load ledger." : (error as Error).message }, { status });
  }
}
