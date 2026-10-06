import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, resolveUserId, withSerializableRetry } from "@/server/db";
import { auth } from "@/auth";
import { appendAuditEvent } from "@/server/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated support-case endpoints for logged-in users.
 *
 * - GET: list the caller's own support cases (newest first).
 * - POST: create a new support case linked to the caller's account.
 *
 * These run on the trade subdomain (where the user is logged in), so the
 * session cookie is available and the Origin gate (same-origin) applies
 * naturally. No rate limit — authenticated users are trusted to self-regulate,
 * and abuse would be visible per-account.
 */

const CATEGORIES = ["General enquiry", "Account & verification", "Deposits & withdrawals", "Technical issue", "Partnership"] as const;

const Create = z.object({
  subject: z.enum(CATEGORIES).default("General enquiry"),
  message: z.string().trim().min(10).max(5000),
});

export async function GET() {
  try {
    const session = await auth();
    const userId = await resolveUserId(session?.user?.id);

    const cases = await prisma.supportCase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        reference: true,
        subject: true,
        category: true,
        status: true,
        priority: true,
        description: true,
        resolutionNote: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
      },
    });

    return NextResponse.json({
      cases: cases.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        resolvedAt: c.resolvedAt?.toISOString() ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unable to load your support cases." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = await resolveUserId(session?.user?.id);

    const parsed = Create.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a subject and a message of at least 10 characters.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { subject, message } = parsed.data;
    const reference = `SUP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const supportCase = await withSerializableRetry(async (tx) => {
      const created = await tx.supportCase.create({
        data: {
          reference,
          userId,
          subject,
          description: message,
          category: subject,
          priority: "NORMAL",
          createdById: userId,
          assignedToId: null,
        },
      });

      await appendAuditEvent(tx, {
        domain: "SUPPORT",
        actorId: userId,
        action: "SUPPORT_CASE_CREATED",
        entityType: "SupportCase",
        entityId: created.id,
        metadata: {
          reference,
          source: "account-portal",
          category: created.category,
        },
      });

      return created;
    });

    return NextResponse.json({ ok: true, reference: supportCase.reference, case: { ...supportCase, createdAt: supportCase.createdAt.toISOString(), updatedAt: supportCase.updatedAt.toISOString() } }, { status: 201 });
  } catch (error) {
    console.error("Account support case creation failed", error);
    return NextResponse.json({ error: "We couldn't create your support case. Please try again." }, { status: 500 });
  }
}
