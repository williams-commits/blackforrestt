import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/guard";
import {
  CreateUser,
  UpdateUser,
  createUser,
  listUsers,
  updateUser,
} from "@/server/records/adminManage";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Staff directory (read) + user administration (write, USERS_MANAGE). */

const IdQuery = z.object({ id: z.string().min(5) });

export async function GET() {
  try {
    await requirePermission("USERS_MANAGE");
    return NextResponse.json({ data: await listUsers() });
  } catch (error) {
    return handleRouteError(error, "Unable to load users.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requirePermission("USERS_MANAGE");
    const parsed = await parseJsonBody(request, CreateUser);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createUser(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create user.");
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requirePermission("USERS_MANAGE");
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const parsedId = IdQuery.safeParse({ id });
    if (!parsedId.success) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const parsed = await parseJsonBody(request, UpdateUser);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateUser(ctx, parsedId.data.id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update user.");
  }
}
