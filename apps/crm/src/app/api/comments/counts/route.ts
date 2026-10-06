import { NextResponse } from "next/server";
import { COMMENT_SUBJECTS, countComments } from "@/server/records/comments";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/comments/counts?subjectType=NOTE&ids=a,b,c → { data: { [id]: count } } */
export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("TASKS_VIEW");
    const params = new URL(request.url).searchParams;
    const subjectType = params.get("subjectType");
    const ids = (params.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    if (!subjectType || !(COMMENT_SUBJECTS as readonly string[]).includes(subjectType)) {
      return NextResponse.json({ error: "Invalid comment subject." }, { status: 400 });
    }
    if (ids.length === 0 || ids.length > 100) {
      return NextResponse.json({ error: "Provide 1–100 ids." }, { status: 400 });
    }
    return NextResponse.json({ data: await countComments(ctx, subjectType as "TASK" | "NOTE" | "APPOINTMENT", ids) });
  } catch (error) {
    return handleRouteError(error, "Unable to load comment counts.");
  }
}
