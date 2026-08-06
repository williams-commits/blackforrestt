import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withSerializableRetry } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";
import { getRedis } from "@/server/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public support-case intake. Customers (and anonymous visitors) submit the
 * contact form on the marketing site, which creates a SupportCase that appears
 * in the admin Support tab. No session required — this is the public entry
 * point for the support inbox.
 *
 * Rate limited per IP via Redis (5 submissions / 15 minutes) with a local
 * in-memory fallback when Redis is unavailable. Honeypot + minimal length
 * checks cut down drive-by spam without a CAPTCHA.
 */

const CATEGORIES = ["General enquiry", "Account & verification", "Deposits & withdrawals", "Technical issue", "Partnership"] as const;

const Create = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  subject: z.enum(CATEGORIES).default("General enquiry"),
  message: z.string().trim().min(10).max(5000),
  // Honeypot: must be empty. Bots fill hidden fields; humans never see it.
  company: z.string().max(0).optional(),
});

const RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const RATE_LIMIT_MAX = 5; // 5 submissions per window per IP
const SYNTHETIC_ACTOR_ID = "system:public-contact-form";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

/**
 * Sliding-window-ish rate limit via Redis INCR + EXPIRE. Falls back to a local
 * in-memory counter when Redis is unavailable (development only).
 */
async function checkRateLimit(key: string): Promise<RateLimitResult> {
  try {
    const redis = await getRedis();
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    const ttl = await redis.ttl(key);
    return {
      allowed: count <= RATE_LIMIT_MAX,
      remaining: Math.max(0, RATE_LIMIT_MAX - count),
      retryAfter: ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS,
    };
  } catch {
    // Redis unavailable — local in-memory fallback (resets on process restart).
    return checkLocalRateLimit(key);
  }
}

const localCounters = new Map<string, { count: number; expiresAt: number }>();

function checkLocalRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const existing = localCounters.get(key);
  if (!existing || existing.expiresAt <= now) {
    localCounters.set(key, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_SECONDS * 1_000 });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, retryAfter: RATE_LIMIT_WINDOW_SECONDS };
  }
  existing.count += 1;
  return {
    allowed: existing.count <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - existing.count),
    retryAfter: Math.ceil((existing.expiresAt - now) / 1_000),
  };
}

function requestNetworkAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request) {
  const ip = requestNetworkAddress(request);
  const rateKey = `support:intake:${ip}`;

  // Rate limit BEFORE any DB work.
  const rate = await checkRateLimit(rateKey);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please complete all fields with valid values.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Honeypot triggered — silently accept to not tip off the bot, but don't
  // create a case.
  if (parsed.data.company) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  try {
    const { name, email, subject, message } = parsed.data;
    const reference = `SUP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const supportCase = await withSerializableRetry(async (tx) => {
      // Look up an existing user by email so the case links to their account
      // when one exists (optional — anonymous submissions are fine).
      const user = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });

      const created = await tx.supportCase.create({
        data: {
          reference,
          userId: user?.id ?? null,
          subject: subject,
          description: `[${name} <${email}>]\n\n${message}`,
          category: subject,
          priority: "NORMAL",
          createdById: SYNTHETIC_ACTOR_ID,
          // Unassigned until an admin picks it up.
          assignedToId: null,
        },
      });

      await appendAuditEvent(tx, {
        domain: "SUPPORT",
        actorId: SYNTHETIC_ACTOR_ID,
        action: "SUPPORT_CASE_CREATED",
        entityType: "SupportCase",
        entityId: created.id,
        metadata: {
          reference,
          source: "public-contact-form",
          email,
          category: created.category,
          networkAddress: ip,
          linkedUserId: user?.id ?? null,
        },
      });

      return created;
    });

    return NextResponse.json({ ok: true, reference: supportCase.reference }, { status: 201 });
  } catch (error) {
    console.error("Support intake failed", error);
    return NextResponse.json({ error: "We couldn't send your message. Please try again or email us directly." }, { status: 500 });
  }
}
