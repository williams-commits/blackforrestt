import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, resolveUserId } from "@/server/db";
import { auth } from "@/auth";
import { KYC_DOCUMENT_TYPE_VALUES, isAddressDocumentType, isIdentityDocumentType } from "@/lib/kyc";
import { queueUserEmail } from "@/server/email/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SubmitSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  dob: z.coerce.date(),
  country: z.string().trim().min(2).max(100),
  address: z.string().trim().min(3).max(200),
  city: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().max(32).optional().nullable(),
  docType: z.enum(KYC_DOCUMENT_TYPE_VALUES),
});

function validateAge(dob: Date): string | null {
  const now = new Date();
  if (Number.isNaN(dob.getTime()) || dob > now) return "Date of birth is invalid.";

  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const birthdayPassed =
    now.getUTCMonth() > dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() >= dob.getUTCDate());
  if (!birthdayPassed) age -= 1;

  if (age < 18) return "You must be at least 18 years old.";
  if (age > 120) return "Date of birth is invalid.";
  return null;
}

/** GET /api/kyc — the user's KYC submission (if any). */
export async function GET() {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const kyc = await prisma.kycSubmission.findUnique({ where: { userId } });
  return NextResponse.json({ kyc });
}

/** POST /api/kyc — submit or re-submit a non-approved KYC case. */
export async function POST(req: Request) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ageError = validateAge(parsed.data.dob);
  if (ageError) return NextResponse.json({ error: ageError }, { status: 400 });

  const current = await prisma.kycSubmission.findUnique({
    where: { userId },
    select: { status: true },
  });
  if (current?.status === "APPROVED") {
    return NextResponse.json(
      { error: "Approved identity details cannot be replaced without a compliance review." },
      { status: 409 },
    );
  }

  const cleanDocuments = await prisma.kycDocument.findMany({
    where: { userId, deletedAt: null, status: "CLEAN" },
    orderBy: { finalizedAt: "desc" },
    select: { id: true, docType: true },
  });
  const selectedDocument = cleanDocuments.find((document) => document.docType === parsed.data.docType);
  if (!selectedDocument) {
    return NextResponse.json(
      { error: "Upload and verify the selected document type before submitting verification." },
      { status: 409 },
    );
  }
  if (!cleanDocuments.some((document) => isIdentityDocumentType(document.docType))) {
    return NextResponse.json(
      { error: "Upload and verify at least one identity document: passport, national ID, or driving licence." },
      { status: 409 },
    );
  }
  if (!cleanDocuments.some((document) => isAddressDocumentType(document.docType))) {
    return NextResponse.json(
      { error: "Upload and verify proof of address, such as a utility bill or bank statement." },
      { status: 409 },
    );
  }

  const d = parsed.data;
  const submittedAt = new Date();
  const commonData = {
    status: "PENDING" as const,
    firstName: d.firstName,
    lastName: d.lastName,
    dob: d.dob,
    country: d.country,
    address: d.address,
    city: d.city,
    postalCode: d.postalCode || null,
    docType: d.docType,
    docReference: selectedDocument.id,
    note: null,
    submittedAt,
    reviewedAt: null,
  };

  const kyc = await prisma.$transaction(async (tx) => {
    const submission = await tx.kycSubmission.upsert({
      where: { userId },
      update: commonData,
      create: { userId, ...commonData },
    });
    await tx.notification.create({ data: { userId, type: "KYC_SUBMITTED", title: "Verification submitted", body: "Your identity verification is queued for compliance review.", metadata: { kycSubmissionId: submission.id } } });
    await queueUserEmail(tx, { userId, template: "kyc-submitted", variables: { message: "Your identity verification is queued for compliance review." } });
    return submission;
  });

  return NextResponse.json({ ok: true, kyc }, { status: 202 });
}
