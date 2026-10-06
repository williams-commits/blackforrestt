import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

/**
 * Read-only check used by the login and registration flows to decide whether
 * to offer a "resend verification email" action. Only ever reports
 * `needsVerification: true` when the email is registered AND unverified; every
 * other case (unknown email, already verified) returns `false` so the endpoint
 * never confirms whether an account exists.
 */
export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ needsVerification: false }, { status: 200 });
  }
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { emailVerifiedAt: true },
  });
  const needsVerification = Boolean(user && !user.emailVerifiedAt);
  return NextResponse.json({ needsVerification }, { status: 200 });
}
