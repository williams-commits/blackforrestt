import { NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serialize<T extends { dob: Date | null; submittedAt: Date | null; reviewedAt: Date | null }>(item: T) {
  return { ...item, dob: item.dob?.toISOString() ?? null, submittedAt: item.submittedAt?.toISOString() ?? null, reviewedAt: item.reviewedAt?.toISOString() ?? null };
}

export async function GET() {
  try {
    await requireAdmin("KYC_READ");
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
