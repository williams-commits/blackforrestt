import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, resolveUserId } from "@/server/db";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100, "Name is too long."),
});

/** POST /api/profile — update display name. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid name." },
      { status: 400 },
    );
  }

  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const { name } = parsed.data;

  await prisma.user.update({ where: { id: userId }, data: { name } });
  return NextResponse.json({ ok: true, name });
}
