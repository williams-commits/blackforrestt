import { AdminConsole } from "@/components/AdminConsole";
import { auth } from "@/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Administration" };

export default async function AdminPage() {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: { select: { permissions: { select: { permission: true } } } } },
      })
    : null;
  const permissions = new Set(user?.role.permissions.map((entry) => entry.permission) ?? []);
  return (
    <AdminConsole
      canManage={permissions.has("SETTINGS_MANAGE")}
      canAudit={permissions.has("AUDIT_VIEW")}
    />
  );
}
