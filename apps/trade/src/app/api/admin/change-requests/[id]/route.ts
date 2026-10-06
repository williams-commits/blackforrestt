import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, canReviewChangeDomain, requireAdminContext } from "@/server/admin";
import { AdminChangeError, reviewAdminChangeRequest } from "@/server/adminChanges";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Review = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().min(3).max(1000),
});

function errorStatus(error: unknown): number {
  if (error instanceof AdminError || error instanceof AdminChangeError) return error.status;
  return 500;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const reviewer = await requireAdminContext("CHANGE_REQUEST_APPROVE");
    const parsed = Review.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid review decision.", details: parsed.error.flatten() }, { status: 400 });
    const { id } = await context.params;
    const pending = await prisma.adminChangeRequest.findUnique({ where: { id }, select: { domain: true } });
    if (!pending) return NextResponse.json({ error: "Change request not found." }, { status: 404 });
    if (!canReviewChangeDomain(reviewer, pending.domain)) {
      return NextResponse.json({ error: `Forbidden — your roles cannot approve ${pending.domain} changes.` }, { status: 403 });
    }
    const result = await reviewAdminChangeRequest({
      requestId: id,
      reviewerId: reviewer.actorId,
      decision: parsed.data.decision,
      note: parsed.data.note,
    });
    return NextResponse.json({ request: result });
  } catch (error) {
    const status = errorStatus(error);
    return NextResponse.json({ error: status === 500 ? "Unable to review change request." : (error as Error).message }, { status });
  }
}
