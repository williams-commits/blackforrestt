import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { crmBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const branding = crmBranding();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: { select: { permissions: { select: { permission: true } } } } },
  });
  const hasAdminAccess = user?.role.permissions.some(
    (entry) => ["ADMIN_ACCESS", "SETTINGS_MANAGE", "AUDIT_VIEW"].includes(entry.permission)
  );
  if (!hasAdminAccess) redirect("/");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 border-b border-(--border-default) pb-5">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--text-tertiary)">{branding.short} setup</p>
        <h1 className="page-title">Administration</h1>
        <p className="page-subtitle">Configure your workspace, access, and operating rules.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[208px_1fr] lg:items-start">
        <AdminNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
