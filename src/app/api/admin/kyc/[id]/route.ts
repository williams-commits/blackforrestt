import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAdmin, AdminError } from "@/server/admin";
import { queueUserEmail } from "@/server/email/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReviewSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]),
    note: z.string().trim().max(1_000).optional().default(""),
  })
  .superRefine((value, context) => {
    if (value.action === "REJECT" && value.note.length < 3) {
      context.addIssue({ code: "custom", path: ["note"], message: "A rejection note is required." });
    }
  });

/** POST /api/admin/kyc/[id] — atomically approve or reject a pending case. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin("KYC_DECIDE");
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 401;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status });
  }

  const { id } = await params;
  if (!/^c[a-z0-9]{20,}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid submission id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid review action." },
      { status: 400 },
    );
  }

  const newStatus = parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED";
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.kycSubmission.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });
    if (!existing) return "NOT_FOUND" as const;
    if (existing.status !== "PENDING") return "CONFLICT" as const;

    await tx.kycSubmission.update({
      where: { id },
      data: {
        status: newStatus,
        note: parsed.data.action === "REJECT" ? parsed.data.note : null,
        reviewedAt: new Date(),
      },
    });
    await tx.user.update({
      where: { id: existing.userId },
      data: { verified: parsed.data.action === "APPROVE" },
    });
    const approved = parsed.data.action === "APPROVE";
    const message = approved ? "Your identity verification has been approved." : `Your identity verification needs attention: ${parsed.data.note}`;
    await tx.notification.create({ data: { userId: existing.userId, type: approved ? "KYC_APPROVED" : "KYC_REJECTED", title: approved ? "Verification approved" : "Verification needs attention", body: message, metadata: { kycSubmissionId: id } } });
    await queueUserEmail(tx, { userId: existing.userId, template: approved ? "kyc-approved" : "kyc-rejected", variables: { message } });
    return "UPDATED" as const;
  });

  if (result === "NOT_FOUND") {
    return NextResponse.json({ error: "KYC submission not found." }, { status: 404 });
  }
  if (result === "CONFLICT") {
    return NextResponse.json({ error: "This KYC submission has already been reviewed." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, id, status: newStatus });
}
