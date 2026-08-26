import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma, withSerializableRetry } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
const Create = z.object({
  userId: z.string().trim().min(10).max(64).optional().nullable(),
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(3).max(5000),
  category: z.string().trim().min(2).max(80),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export async function GET(request: Request) {
  try {
    await requireAdmin("SUPPORT_READ");
    const params = new URL(request.url).searchParams;
    const parsed = Query.safeParse({ status: params.get("status") ?? undefined, limit: params.get("limit") ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: "Invalid support query." }, { status: 400 });
    const cases = await prisma.supportCase.findMany({
      where: { status: parsed.data.status },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: parsed.data.limit,
    });
    // Brand attribution (SupportCase stores a plain userId, no relation): one
    // grouped lookup for the customers on this page.
    const userIds = [...new Set(cases.map((item) => item.userId).filter((id): id is string => Boolean(id)))];
    const brandByUser = new Map(
      userIds.length > 0
        ? (await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, brandDomain: true } })).map((u) => [u.id, u.brandDomain])
        : [],
    );
    return NextResponse.json({ cases: cases.map((item) => ({ ...item, brandDomain: brandByUser.get(item.userId ?? "") ?? null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), resolvedAt: item.resolvedAt?.toISOString() ?? null, closedAt: item.closedAt?.toISOString() ?? null })) });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to load support cases." : (error as Error).message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actorId = await requireAdmin("SUPPORT_MANAGE");
    const parsed = Create.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid support case.", details: parsed.error.flatten() }, { status: 400 });
    const result = await withSerializableRetry(async (tx) => {
      if (parsed.data.userId) {
        const customer = await tx.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
        if (!customer) throw new AdminError("Support-case customer not found.", 404);
      }
      const reference = `SUP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const supportCase = await tx.supportCase.create({
        data: {
          reference,
          userId: parsed.data.userId ?? null,
          subject: parsed.data.subject,
          description: parsed.data.description,
          category: parsed.data.category,
          priority: parsed.data.priority,
          createdById: actorId,
          assignedToId: actorId,
        },
      });
      await appendAuditEvent(tx, { domain: "SUPPORT", actorId, action: "SUPPORT_CASE_CREATED", entityType: "SupportCase", entityId: supportCase.id, metadata: { reference, priority: supportCase.priority, category: supportCase.category, userId: supportCase.userId } });
      return supportCase;
    });
    return NextResponse.json({ case: result }, { status: 201 });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to create support case." : (error as Error).message }, { status });
  }
}
