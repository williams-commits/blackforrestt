import { NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serialize<T extends { dob: Date | null; submittedAt: Date | null; reviewedAt: Date | null }>(item: T) {
  return { ...item, dob: item.dob?.toISOString() ?? null, submittedAt: item.submittedAt?.toISOString() ?? null, reviewedAt: item.reviewedAt?.toISOString() ?? null };
}

export async function GET(request: Request) {
  try {
    await requireAdmin("KYC_READ");
    const { searchParams } = new URL(request.url);
    const reviewedOffset = Math.max(0, Number(searchParams.get("reviewedOffset") ?? 0) || 0);

    // Paged tail fetch for the "Recent decisions" load-more: returns just the
    // next reviewed page past the offset, skipping the workspace queries.
    if (searchParams.has("reviewedOffset")) {
      const reviewed = await prisma.kycSubmission.findMany({
        where: { status: { in: ["APPROVED", "REJECTED"] } },
        orderBy: { reviewedAt: "desc" },
        skip: reviewedOffset,
        take: 50,
        include: { user: { select: { email: true, name: true, accountNo: true } } },
      });
      return NextResponse.json({ reviewed: reviewed.map(serialize) });
    }

    const [pending, reviewed, total, reviewedTotal] = await Promise.all([
      prisma.kycSubmission.findMany({ where: { status: "PENDING" }, orderBy: { submittedAt: "asc" }, take: 200, include: { user: { select: { email: true, name: true, accountNo: true } } } }),
      prisma.kycSubmission.findMany({ where: { status: { in: ["APPROVED", "REJECTED"] } }, orderBy: { reviewedAt: "desc" }, take: 50, include: { user: { select: { email: true, name: true, accountNo: true } } } }),
      prisma.kycSubmission.count(),
      prisma.kycSubmission.count({ where: { status: { in: ["APPROVED", "REJECTED"] } } }),
    ]);
    return NextResponse.json({ pending: pending.map(serialize), reviewed: reviewed.map(serialize), total, reviewedTotal });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to load KYC workspace." : (error as Error).message }, { status });
  }
}
