import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";
import { hub } from "@/server/engine/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

const SEARCHABLE_KYC_STATUSES = ["NOT_SUBMITTED", "PENDING", "APPROVED", "REJECTED"] as const;
const SEARCHABLE_ADMIN_ROLES = ["SUPER_ADMIN", "COMPLIANCE", "FINANCE", "DEALER", "RISK", "SUPPORT", "AUDITOR"] as const;

export async function GET(request: Request) {
  try {
    await requireAdmin("USER_READ");
    const url = new URL(request.url);
    const parsed = Query.safeParse({ q: url.searchParams.get("q") ?? undefined, limit: url.searchParams.get("limit") ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: "Invalid user query." }, { status: 400 });
    const q = parsed.data.q || undefined;
    const normalizedQuery = q?.toLowerCase();
    const matchingKycStatuses = normalizedQuery
      ? SEARCHABLE_KYC_STATUSES.filter((status) => status.toLowerCase().includes(normalizedQuery))
      : [];
    const matchingAdminRoles = normalizedQuery
      ? SEARCHABLE_ADMIN_ROLES.filter((role) => role.toLowerCase().includes(normalizedQuery))
      : [];
    const where = q ? {
      OR: [
        { id: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { name: { contains: q, mode: "insensitive" as const } },
        { accountNo: { contains: q } },
        { brandDomain: { contains: q, mode: "insensitive" as const } },
        {
          kyc: {
            is: {
              OR: [
                { country: { contains: q, mode: "insensitive" as const } },
                { city: { contains: q, mode: "insensitive" as const } },
                ...(matchingKycStatuses.length ? [{ status: { in: matchingKycStatuses } }] : []),
              ],
            },
          },
        },
        ...(matchingAdminRoles.length
          ? [{ adminRoles: { some: { revokedAt: null, role: { in: matchingAdminRoles } } } }]
          : []),
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
          isAdmin: true,
          brandDomain: true,
          suspendedAt: true,
          blockedAt: true,
          deletedAt: true,
          emailVerifiedAt: true,
          lockedUntil: true,
          mfaEnabledAt: true,
          createdAt: true,
          metrics: { select: { balance: true, equity: true, floatingPl: true, marginLevel: true } },
          kyc: { select: { status: true, country: true, city: true } },
          adminRoles: { where: { revokedAt: null }, select: { role: true, assignedAt: true } },
          // Most recent activity across devices (lastSeenAt is refreshed by
          // the ws/account bridge while a session is alive).
          securitySessions: { orderBy: { lastSeenAt: "desc" }, take: 1, select: { lastSeenAt: true } },
          _count: {
            select: {
              // Open positions only — "is this user trading right now".
              positions: { where: { status: "OPEN" } },
              securitySessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } } },
              reconciliationBlocks: true,
            },
          },
        },
      }),
      // Honest total so the UI can disclose truncation ("showing first 200 of N").
      prisma.user.count({ where }),
    ]);
    // Live presence from the process-wide engine hub (WebSocket connections).
    const online = hub.onlineUserIds();
    return NextResponse.json({ total, users: users.map((user) => ({
      ...user,
      online: online.has(user.id),
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      lastActiveAt: user.securitySessions[0]?.lastSeenAt?.toISOString() ?? null,
      lockedUntil: user.lockedUntil?.toISOString() ?? null,
      isAdmin: user.isAdmin,
      suspendedAt: user.suspendedAt?.toISOString() ?? null,
      blockedAt: user.blockedAt?.toISOString() ?? null,
      deletedAt: user.deletedAt?.toISOString() ?? null,
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
