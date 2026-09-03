import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Saved, reusable column mappings. */

const CreateMapping = z.object({
  name: z.string().trim().min(1).max(100),
  objectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER"]),
  mapping: z.record(z.string()),
});

export async function GET() {
  try {
    await scopedContext("LEADS_IMPORT");
    const mappings = await prisma.importMapping.findMany({
      where: { source: "CSV" },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: mappings });
  } catch (error) {
    return handleRouteError(error, "Unable to load mappings.");
  }
}

export async function POST(request: Request) {
  try {
    await scopedContext("LEADS_IMPORT");
    const parsed = await parseJsonBody(request, CreateMapping);
    if (!parsed.ok) return parsed.response;
    const mapping = await prisma.importMapping.upsert({
      where: {
        name_source_objectType: {
          name: parsed.data.name,
          source: "CSV",
          objectType: parsed.data.objectType,
        },
      },
      create: { ...parsed.data, source: "CSV", mapping: parsed.data.mapping as never },
      update: { mapping: parsed.data.mapping as never },
    });
    return NextResponse.json({ data: mapping }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to save mapping.");
  }
}

export async function DELETE(request: Request) {
  try {
    await scopedContext("LEADS_IMPORT");
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await prisma.importMapping.deleteMany({ where: { id } });
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete mapping.");
  }
}
