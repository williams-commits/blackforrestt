#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("reconciliation:reset-local is disabled when NODE_ENV=production.");
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const blocks = await tx.reconciliationBlock.updateMany({
      where: { releasedAt: null },
      data: {
        releasedAt: now,
        releasedBy: "LOCAL_DEVELOPMENT_RESET",
        releaseNote: "Released by the explicit local development reset command.",
      },
    });
    const cases = await tx.reconciliationCase.updateMany({
      where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      data: {
        status: "RESOLVED",
        resolvedAt: now,
        resolutionNote: "Resolved by the explicit local development reset command.",
      },
    });
    return { blocks: blocks.count, cases: cases.count };
  }, { isolationLevel: "Serializable" });

  console.log(`✓ Released ${result.blocks} local reconciliation block(s).`);
  console.log(`✓ Resolved ${result.cases} local reconciliation case(s).`);
  console.log("  Production execution is structurally blocked by NODE_ENV=production.");
}

main()
  .catch((error) => {
    console.error("Local reconciliation reset failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
