import { ImportWizard } from "@/components/ImportWizard";
import { auth } from "@/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Import" };

export default async function ImportsPage() {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: { select: { permissions: { select: { permission: true } } } } },
      })
    : null;
  const hasPermission =
    user?.role.permissions.some((entry) => entry.permission === "LEADS_IMPORT") ?? false;

  return <ImportWizard hasPermission={hasPermission} />;
}
