import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/guard";
import { prisma } from "@/server/db";
import { encryptSecret } from "@/server/secretBox";
import { appendAudit } from "@/server/audit";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const SmtpConfig = z.object({
  host: z.string().trim().min(3).max(200),
  port: z.coerce.number().int().min(1).max(65_535).default(587),
  secure: z.coerce.boolean().default(true),
  username: z.string().trim().min(1).max(200),
  /** Write-only: omitted/empty keeps the stored password. */
  password: z.string().min(1).max(200).optional(),
  fromName: z.string().trim().max(120).optional().nullable(),
  fromAddress: z.string().trim().email().max(200),
});

/** GET — a user's SMTP config; the password never leaves the server. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission("USERS_MANAGE");
    const { id } = await context.params;
    const config = await prisma.userSmtp.findUnique({ where: { userId: id } });
    if (!config) return NextResponse.json({ data: null });
    return NextResponse.json({
      data: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        username: config.username,
        hasPassword: true,
        fromName: config.fromName,
        fromAddress: config.fromAddress,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load the SMTP configuration.");
  }
}

/** PUT — create or replace a user's SMTP config (password encrypted at rest). */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await requirePermission("USERS_MANAGE");
    const { id } = await context.params;
    const parsed = await parseJson(request, SmtpConfig);
    if (!parsed.ok) return parsed.response;

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const existing = await prisma.userSmtp.findUnique({ where: { userId: id } });
    if (!parsed.data.password && !existing?.passwordEncrypted) {
      return NextResponse.json({ error: "A password is required for the first save." }, { status: 400 });
    }
    const passwordEncrypted = parsed.data.password
      ? encryptSecret(parsed.data.password)
      : (existing?.passwordEncrypted as string);

    const saved = await prisma.userSmtp.upsert({
      where: { userId: id },
      create: {
        userId: id,
        host: parsed.data.host,
        port: parsed.data.port,
        secure: parsed.data.secure,
        username: parsed.data.username,
        passwordEncrypted,
        fromName: parsed.data.fromName ?? null,
        fromAddress: parsed.data.fromAddress,
      },
      update: {
        host: parsed.data.host,
        port: parsed.data.port,
        secure: parsed.data.secure,
        username: parsed.data.username,
        passwordEncrypted,
        fromName: parsed.data.fromName ?? null,
        fromAddress: parsed.data.fromAddress,
      },
    });

    await prisma.$transaction((tx) =>
      appendAudit(tx, {
        actorId: actor.userId,
        ip: actor.ip,
        action: "USER_SMTP_SAVED",
        objectType: "User",
        objectId: id,
        after: { host: saved.host, port: saved.port, secure: saved.secure, fromAddress: saved.fromAddress },
      }),
    );
    return NextResponse.json({ data: { saved: true } });
  } catch (error) {
    return handleRouteError(error, "Unable to save the SMTP configuration.");
  }
}

/** DELETE — remove the override; the user falls back to the global SMTP. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePermission("USERS_MANAGE");
    const { id } = await context.params;
    const existing = await prisma.userSmtp.findUnique({ where: { userId: id } });
    if (existing) {
      await prisma.userSmtp.delete({ where: { userId: id } });
      await prisma.$transaction((tx) =>
        appendAudit(tx, {
          actorId: actor.userId,
          action: "USER_SMTP_REMOVED",
          objectType: "User",
          objectId: id,
        }),
      );
    }
    return NextResponse.json({ data: { removed: true } });
  } catch (error) {
    return handleRouteError(error, "Unable to remove the SMTP configuration.");
  }
}

async function parseJson<S extends z.ZodTypeAny>(request: Request, schema: S) {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Invalid SMTP configuration.", details: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }
  return { ok: true as const, data: parsed.data };
}
