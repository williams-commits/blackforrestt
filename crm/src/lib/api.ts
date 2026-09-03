import { NextResponse } from "next/server";
import { z, type ZodTypeAny } from "zod";
import { CrmError } from "@/server/guard";

/** Uniform JSON error envelope for API route handlers. */
export function jsonError(message: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json(
    details === undefined ? { error: message } : { error: message, details },
    { status },
  );
}

/**
 * Map a thrown error to the uniform error envelope. CrmError carries its own
 * HTTP status; anything else is a 500 with a generic message so internals
 * never leak to the client.
 */
export function handleRouteError(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof CrmError) {
    return jsonError(error.message, error.status);
  }
  console.error("[crm/api]", error);
  return jsonError(fallbackMessage, 500);
}

/** Parse and validate a JSON request body against a zod schema. */
export async function parseJsonBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: NextResponse }> {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: jsonError("Invalid request body.", 400, parsed.error.flatten()) };
  }
  return { ok: true, data: parsed.data };
}
