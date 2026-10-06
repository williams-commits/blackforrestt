import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, resolveUserId } from "@/server/db";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().cuid().optional(),
  type: z
    .enum(["DEPOSIT", "WITHDRAW", "BONUS", "ADJUSTMENT", "COMMISSION", "SWAP", "TRADE_PNL"])
    .optional(),
  status: z.enum(["PENDING", "COMPLETED", "REJECTED"]).optional(),
});

/** GET /api/transactions — cursor-paginated account transaction history. */
export async function GET(req: Request) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const search = new URL(req.url).searchParams;
  const parsed = QuerySchema.safeParse({
    limit: search.get("limit") ?? undefined,
    cursor: search.get("cursor") ?? undefined,
    type: search.get("type") ?? undefined,
    status: search.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transaction query." }, { status: 400 });
  }

  const { limit, cursor, type, status } = parsed.data;
  const txns = await prisma.transaction.findMany({
    where: { userId, type, status },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = txns.length > limit;
  const page = hasMore ? txns.slice(0, limit) : txns;

  return NextResponse.json({
    transactions: page.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: Number(transaction.amount),
      asset: transaction.asset,
      description: transaction.description,
      reference: transaction.reference,
      createdAt: transaction.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  });
}
