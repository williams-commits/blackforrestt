import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/guard";
import { decryptSecret } from "@/server/secretBox";
import { verifyTransport } from "@/server/email";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const TestBody = z.object({  // zod schema reused for body parsing below
  /** Pre-save test: verify these values instead of the saved configuration. */
  host: z.string().trim().min(3).max(200).optional(),
  port: z.coerce.number().int().min(1).max(65_535).optional(),
  secure: z.coerce.boolean().optional(),
  username: z.string().trim().min(1).max(200).optional(),
  password: z.string().min(1).max(200).optional(),
});

/**
 * POST — verify a user's SMTP connection. Without a body, tests the SAVED
 * configuration (decrypting the stored password server-side). With host/
 * username/password, tests the provided values before saving.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    await requirePermission("USERS_MANAGE");
    const { id } = await context.params;
    const parsed = TestBody.safeParse(await request.json().catch(() => ({})));
    const body = parsed.success ? parsed.data : {} as z.infer<typeof TestBody>;

    let host = body.host;
    let username = body.username;
    let password = body.password;
    let port = body.port;
    let secure = body.secure;

    if (!host || !username || !password) {
      const saved = await prisma.userSmtp.findUnique({ where: { userId: id } });
      if (!saved) {
        return NextResponse.json({ error: "No SMTP configuration to test." }, { status: 404 });
      }
      host = saved.host;
      username = saved.username;
      password = decryptSecret(saved.passwordEncrypted);
      port = port ?? saved.port;
      secure = secure ?? saved.secure;
    }

    const result = await verifyTransport({
      host,
      port: port ?? 587,
      secure: secure ?? true,
      username,
      password,
      from: "",
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleRouteError(error, "Unable to test the SMTP connection.");
  }
}
