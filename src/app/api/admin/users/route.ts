import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export async function GET(request: Request) {
  try {
    await requireAdmin("USER_READ");
    const url = new URL(request.url);
    const parsed = Query.safeParse({ q: url.searchParams.get("q") ?? undefined, limit: url.searchParams.get("limit") ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: "Invalid user query." }, { status: 400 });
    const q = parsed.data.q;
    const where = q ? {
      OR: [
        { email: { contains: q, mode: "insensitive" as const } },
        { name: { contains: q, mode: "insensitive" as const } },
        { accountNo: { contains: q } },
      ],
    } : undefined;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parsed.data.limit,
        select: {
          id: true,
          email: true,
          name: true,
          accountNo: true,
          verified: true,
          emailVerifiedAt: true,
          lockedUntil: true,
          mfaEnabledAt: true,
          createdAt: true,
          metrics: { select: { balance: true, equity: true, floatingPl: true, marginLevel: true } },
          kyc: { select: { status: true } },
          adminRoles: { where: { revokedAt: null }, select: { role: true, assignedAt: true } },
          _count: { select: { positions: true, securitySessions: true, reconciliationBlocks: true } },
        },
      }),
      // Honest total so the UI can disclose truncation ("showing first 200 of N").
      prisma.user.count({ where }),
    ]);
    return NextResponse.json({ total, users: users.map((user) => ({
      ...user,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      lockedUntil: user.lockedUntil?.toISOString() ?? null,
      mfaEnabledAt: user.mfaEnabledAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      metrics: user.metrics ? {
        balance: user.metrics.balance.toFixed(8),
        equity: user.metrics.equity.toFixed(8),
        floatingPl: user.metrics.floatingPl.toFixed(8),
        marginLevel: user.metrics.marginLevel?.toFixed(8) ?? null,
      } : null,
    })) });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to list users." : (error as Error).message }, { status });
  }
}
