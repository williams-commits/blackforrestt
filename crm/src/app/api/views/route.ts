import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/guard";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Saved list views: a user's own views plus views shared with the org. */

const ViewConfig = z
  .object({
    q: z.string().max(120).optional(),
    filters: z.record(z.string()).optional(),
  })
  .passthrough();

const CreateView = z.object({
  objectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER"]),
  name: z.string().trim().min(1).max(80),
  config: ViewConfig,
  shared: z.boolean().default(false),
});

const OBJECT_KEY: Record<string, "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER"> = {
  LEAD: "LEAD",
  CONTACT: "CONTACT",
  ACCOUNT: "ACCOUNT",
  CUSTOMER: "CUSTOMER",
};

export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("LEADS_READ");
    const objectType = new URL(request.url).searchParams.get("objectType");
    const views = await prisma.savedView.findMany({
      where: {
        ...(objectType && OBJECT_KEY[objectType] ? { objectType: OBJECT_KEY[objectType] } : {}),
        OR: [{ userId: ctx.userId }, { shared: true }],
      },
      orderBy: [{ shared: "asc" }, { name: "asc" }],
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json({ data: views });
  } catch (error) {
    return handleRouteError(error, "Unable to load views.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requirePermission("LEADS_READ");
    const parsed = await parseJsonBody(request, CreateView);
    if (!parsed.ok) return parsed.response;
    const view = await prisma.savedView.upsert({
      where: {
        userId_objectType_name: {
          userId: ctx.userId,
          objectType: parsed.data.objectType,
          name: parsed.data.name,
        },
      },
      create: {
        userId: ctx.userId,
        objectType: parsed.data.objectType,
        name: parsed.data.name,
        config: parsed.data.config as never,
        shared: parsed.data.shared,
      },
      update: {
        config: parsed.data.config as never,
        shared: parsed.data.shared,
      },
    });
    return NextResponse.json({ data: view }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to save view.");
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requirePermission("LEADS_READ");
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    // Only the owner may delete their saved view.
    await prisma.savedView.deleteMany({ where: { id, userId: ctx.userId } });
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete view.");
  }
}
