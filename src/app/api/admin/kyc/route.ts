import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAdmin, AdminError } from "@/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const StatusSchema = z.enum(["ALL", "NOT_SUBMITTED", "PENDING", "APPROVED", "REJECTED"]);

/** GET /api/admin/kyc — list KYC submissions with a validated status filter. */
export async function GET(req: Request) {
  try {
    await requireAdmin("KYC_READ");
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 401;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status });
  }

  const parsedStatus = StatusSchema.safeParse(new URL(req.url).searchParams.get("status") ?? "PENDING");
  if (!parsedStatus.success) {
    return NextResponse.json({ error: "Invalid KYC status filter." }, { status: 400 });
  }

  const submissions = await prisma.kycSubmission.findMany({
    where: parsedStatus.data === "ALL" ? undefined : { status: parsedStatus.data },
    orderBy: { submittedAt: "desc" },
    take: 500,
    include: { user: { select: { email: true, name: true, accountNo: true } } },
  });

  return NextResponse.json({
    submissions: submissions.map((submission) => ({
      id: submission.id,
      userId: submission.userId,
      status: submission.status,
      firstName: submission.firstName,
      lastName: submission.lastName,
      dob: submission.dob?.toISOString() ?? null,
      country: submission.country,
      address: submission.address,
      city: submission.city,
      postalCode: submission.postalCode,
      docType: submission.docType,
      docReference: submission.docReference,
      note: submission.note,
      submittedAt: submission.submittedAt?.toISOString() ?? null,
      reviewedAt: submission.reviewedAt?.toISOString() ?? null,
      user: submission.user,
    })),
  });
}
