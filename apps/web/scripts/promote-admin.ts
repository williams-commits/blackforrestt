/**
 * Promote an existing user to administrator (or un-delete/un-suspend them so
 * they qualify as an active operator). Idempotent. Audited.
 *
 * Usage (repo root, local dev):
 *   npm run admin:promote -- <email>
 * Production (inside the app container — after `git pull` + image rebuild):
 *   docker compose -f deploy/docker-compose.prod.yml exec app \
 *     node --import tsx scripts/promote-admin.ts <email>
 *
 * BOOTSTRAP FLOW for admin access on a fresh deployment:
 *   1. Promote the FIRST admin with this script (or raw SQL).
 *   2. Promote a SECOND admin too — the Approvals flow is maker-checker and
 *      needs two operators (a maker cannot approve their own request).
 *   3. From then on create/revoke admins in the console: Users tab → kebab →
 *      "Grant admin role" → submit in Approvals → the OTHER admin approves.
 *      Approval creates the role AND sets isAdmin — fully audited.
 */
import { prisma } from "../src/server/db";
import { appendAuditEvent } from "../src/server/ledger";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: promote-admin.ts <email>");
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user with email ${email}. Register the account first, then promote it.`);
    process.exit(1);
  }
  if (user.isAdmin && !user.deletedAt && !user.suspendedAt && !user.blockedAt) {
    console.log(`${email} is already an active administrator — nothing to do.`);
    await prisma.$disconnect();
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { isAdmin: true, deletedAt: null, suspendedAt: null, blockedAt: null },
    });
    await appendAuditEvent(tx, {
      actorId: user.id,
      action: "ADMIN_PROMOTED",
      entityType: "User",
      entityId: user.id,
      metadata: { email, via: "scripts/promote-admin.ts" },
    });
  });
  console.log(`${email} is now an active administrator. They can sign in at /admin and receive customer chat.`);
  await prisma.$disconnect();
}

void main();
