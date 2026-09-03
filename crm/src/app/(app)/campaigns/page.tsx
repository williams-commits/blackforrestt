import { CampaignsPage } from "@/components/CampaignsPage";
import { auth } from "@/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Campaigns" };

export default async function CampaignsRoutePage() {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: { select: { permissions: { select: { permission: true } } } } },
      })
    : null;
  const canCreate =
    user?.role.permissions.some((entry) => entry.permission === "CAMPAIGNS_CREATE") ?? false;
  return <CampaignsPage canCreate={canCreate} />;
}
