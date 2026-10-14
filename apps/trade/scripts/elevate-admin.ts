import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const ROLES = ["SUPER_ADMIN", "COMPLIANCE", "FINANCE", "DEALER", "RISK", "SUPPORT", "AUDITOR"] as const;
async function main() {
  const user = await prisma.user.findUnique({ where: { email: "stage3-probe-1791903119658@blackforrestt.dev" } });
  if (!user) throw new Error("no user");
  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  for (const role of ROLES) {
    await prisma.adminRoleAssignment.upsert({
      where: { userId_role: { userId: user.id, role } },
      create: { userId: user.id, role, reason: "dev elevation for admin UI verification" },
      update: { revokedAt: null, reason: "dev elevation for admin UI verification" },
    });
  }
  console.log("elevated with all roles");
}
main().finally(() => prisma.$disconnect());
