import { NextResponse } from "next/server";
import { AddMember, UpdateMember, addMember, removeMember, updateMemberStatus } from "@/server/records/campaigns";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("CAMPAIGNS_EDIT");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, AddMember);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await addMember(ctx, id, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to add member.");
  }
}

const Remove = z.object({ memberId: z.string().min(5) });

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("CAMPAIGNS_EDIT");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, Remove);
    if (!parsed.ok) return parsed.response;
    await removeMember(ctx, id, parsed.data.memberId);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return handleRouteError(error, "Unable to remove member.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("CAMPAIGNS_EDIT");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdateMember);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateMemberStatus(ctx, id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update member.");
  }
}
