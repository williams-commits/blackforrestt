/**
 * Additive role-permission rollout for the CRM.
 *
 * Grants every system role any permission from its ROLE_DEFINITIONS default
 * that it does not already hold — and NEVER removes anything. This rolls out
 * new permissions (e.g. EMAILS_VIEW / EMAILS_SEND) to existing deployments
 * while preserving every admin customization made through the Roles UI.
 *
 * Run after `prisma migrate deploy` (deploy.sh does both):
 *   node --env-file-if-exists=.env --import tsx scripts/grant-new-permissions.ts
 */
import { prisma } from "../src/server/db";
import { ROLE_DEFINITIONS } from "../src/server/permissions";

let granted = 0;
for (const definition of ROLE_DEFINITIONS) {
  const role = await prisma.role.findUnique({
    where: { key: definition.key },
    select: { id: true, permissions: { select: { permission: true } } },
  });
  if (!role) {
    console.log(`skip ${definition.key} (role does not exist yet — run the seed first)`);
    continue;
  }
  const have = new Set(role.permissions.map((entry) => entry.permission));
  for (const permission of definition.permissions) {
    if (!have.has(permission)) {
      await prisma.rolePermission.create({ data: { roleId: role.id, permission } });
      console.log(`granted ${permission} → ${definition.key}`);
      granted += 1;
    }
  }
}
console.log(granted === 0 ? "all role defaults already granted" : `${granted} permission(s) granted`);
await prisma.$disconnect();
