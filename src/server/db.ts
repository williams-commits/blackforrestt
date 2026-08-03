import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Shared Prisma client. In dev we cache the singleton on `globalThis` to avoid
 * exhausting connections during Next.js hot reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Always cache on globalThis so the custom server (server.ts) and the Next.js
// bundled API routes share the same Prisma client. Without this, the two
// module graphs each construct their own client in production, doubling the
// DB connection pool and diverging from the client the engine initialized.
globalForPrisma.prisma = prisma;

/**
 * Resolve the current user id from a request context. Callers should pass the
 * session they obtained via `auth()` (server component) or read the header.
 * There is no development bypass: a valid authenticated session is required.
 */
export async function resolveUserId(
  sessionUserId: string | null | undefined,
): Promise<string> {
  if (sessionUserId) return sessionUserId;
  throw new Error("Unauthorized");
}

/**
 * Run a serializable transaction with automatic retry on PostgreSQL
 * serialization conflicts (SQLSTATE 40001). Serializable isolation can abort a
 * transaction when a concurrent one's writes conflict with its reads; the
 * documented remedy is to retry the whole transaction. This is required wherever
 * two concurrent requests append to the hash-chained audit stream or otherwise
 * read-then-write shared state.
 */
const SERIALIZATION_RETRYABLE = /serialization failure|deadlock detected|could not serialize|write conflict|Transaction failed due to a write conflict/i;
const RETRYABLE_SQLSTATES = new Set(["40001", "40P01"]);

/** Return true only for errors where PostgreSQL requires the whole transaction to be retried. */
export function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2034") return true;
    if (error.code === "P2010") {
      const databaseCode = typeof error.meta?.code === "string" ? error.meta.code : "";
      if (RETRYABLE_SQLSTATES.has(databaseCode)) return true;
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  return SERIALIZATION_RETRYABLE.test(message);
}

export async function withSerializableRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { maxAttempts?: number; operation?: string } = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 5);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: "Serializable" });
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableTransactionError(error)) throw error;
      const delayMs = Math.min(250, 15 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 20);
      if (attempt > 1) {
        console.warn(
          `${options.operation ?? "Serializable transaction"} conflicted; retrying attempt ${attempt + 1}/${maxAttempts}.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`${options.operation ?? "Serializable transaction"} exhausted retry attempts.`);
}
