import { PrismaClient } from "@prisma/client";

/**
 * Shared Prisma client for the CRM module (its own database). In dev the
 * singleton is cached on `globalThis` so Next.js hot reloads don't exhaust
 * connections.
 */
const globalForPrisma = globalThis as unknown as {
  crmPrisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.crmPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.crmPrisma = prisma;
}
