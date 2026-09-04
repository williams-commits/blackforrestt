import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/guard";
import {
  UpdateRolePermissions,
  listRoles,
  updateRolePermissions,
} from "@/server/records/adminManage";
import { ALL_PERMISSIONS } from "@/server/permissions";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdQuery = z.object({ id: z.string().min(5) });

/** Role list is readable to any admin viewer; edits need ROLES_MANAGE. */
export async function GET() {
  try {
    await requirePermission("USERS_MANAGE");
    return NextResponse.json({
      data: await listRoles(),
      meta: { allPermissions: ALL_PERMISSIONS },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load roles.");
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requirePermission("ROLES_MANAGE");
    const id = new URL(request.url).searchParams.get("id");
    const parsedId = IdQuery.safeParse({ id });
    if (!parsedId.success) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const parsed = await parseJsonBody(request, UpdateRolePermissions);
    if (!parsed.ok) return parsed.response;
    // Unknown permission names are rejected (typo protection).
    const known = new Set<string>(ALL_PERMISSIONS);
    const unknown = parsed.data.permissions.filter((permission) => !known.has(permission as never));
    if (unknown.length > 0) {
      return NextResponse.json({ error: `Unknown permissions: ${unknown.join(", ")}` }, { status: 400 });
    }
    await updateRolePermissions(ctx, parsedId.data.id, parsed.data);
    return NextResponse.json({ data: { id: parsedId.data.id } });
  } catch (error) {
    return handleRouteError(error, "Unable to update role.");
  }
}
