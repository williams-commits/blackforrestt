import { NextResponse } from "next/server";
import { z } from "zod";
import { hub } from "@/server/engine/hub";
import { resolveUserId } from "@/server/db";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdSchema = z.string().cuid();

/** POST /api/positions/[id]/close — close an open position at the executable rate. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid position id." }, { status: 400 });
  }

  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  try {
    const result = await hub.closePositionReq(userId, id);
    if (!result) {
      return NextResponse.json({ error: "Position not found or already closed." }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Position close failed for ${id}:`, error);
    return NextResponse.json({ error: "Unable to close the position." }, { status: 500 });
  }
}
