import type { AdminChangeDomain } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, canReviewChangeDomain, hasAdminPermission, requireAdminContext } from "@/server/admin";
import { AdminChangeError, ChangeRequestInput, createAdminChangeRequest, permissionForChangeDomain } from "@/server/adminChanges";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXECUTED", "CANCELLED"]).optional(),
  domain: z.enum(["ACCESS", "RISK", "INSTRUMENT", "CONFIGURATION"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
const Create = z.object({
  commandKey: z.string().trim().min(8).max(160),
  requestNote: z.string().trim().max(1000).optional(),
  change: ChangeRequestInput,
});

export async function GET(request: Request) {
  try {
    const context = await requireAdminContext("CHANGE_REQUEST_READ");
    const params = new URL(request.url).searchParams;
    const parsed = Query.safeParse({ status: params.get("status") ?? undefined, domain: params.get("domain") ?? undefined, limit: params.get("limit") ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: "Invalid change-request query." }, { status: 400 });
    const requests = await prisma.adminChangeRequest.findMany({
      where: { status: parsed.data.status, domain: parsed.data.domain },
      orderBy: { createdAt: "desc" },
      take: parsed.data.limit,
    });
    return NextResponse.json({ requests: requests.map((item) => ({
      ...item,
      canReview: hasAdminPermission(context, "CHANGE_REQUEST_APPROVE") && canReviewChangeDomain(context, item.domain),
      createdAt: item.createdAt.toISOString(),
      reviewedAt: item.reviewedAt?.toISOString() ?? null,
      executedAt: item.executedAt?.toISOString() ?? null,
      cancelledAt: item.cancelledAt?.toISOString() ?? null,
    })) });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to list change requests." : (error as Error).message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = Create.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid change request.", details: parsed.error.flatten() }, { status: 400 });
    const requiredPermission = permissionForChangeDomain(parsed.data.change.domain as AdminChangeDomain);
    const context = await requireAdminContext(requiredPermission);
    const result = await createAdminChangeRequest({ actorId: context.actorId, commandKey: parsed.data.commandKey, requestNote: parsed.data.requestNote, change: parsed.data.change });
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    const status = error instanceof AdminError || error instanceof AdminChangeError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to create change request." : (error as Error).message }, { status });
  }
}
