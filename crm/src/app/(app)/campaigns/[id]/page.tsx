import Link from "next/link";
import { redirect } from "next/navigation";
import { CrmError } from "@/server/guard";
import { getCampaign } from "@/server/records/campaigns";
import { scopedContext } from "@/server/records/leads";
import { CampaignMemberPicker } from "@/components/CampaignMemberPicker";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;
  let campaign;
  let canEdit = false;
  try {
    const ctx = await scopedContext("CAMPAIGNS_READ");
    campaign = await getCampaign(ctx, id);
    canEdit = ctx.permissions.includes("CAMPAIGNS_EDIT");
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/campaigns");
    throw error;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav className="breadcrumb no-print" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="breadcrumb-sep">/</span>
        <Link href="/campaigns">Campaigns</Link><span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{campaign.name}</span>
      </nav>

      <WorkspaceHeader
        eyebrow="Campaign"
        title={campaign.name}
        subtitle={[
          campaign.status.toLowerCase(),
          `owner ${campaign.owner.name}`,
          campaign.source ? `source ${campaign.source}` : null,
          campaign.description,
        ].filter(Boolean).join(" · ")}
        metrics={[
          { label: "Members", value: campaign.stats.total, tone: "brand" },
          { label: "Responded", value: campaign.stats.responded, tone: "info" },
          { label: "Qualified", value: campaign.stats.byStatus?.QUALIFIED ?? 0, tone: "success" },
          { label: "Converted", value: campaign.stats.byStatus?.CONVERTED ?? 0, tone: "success" },
          {
            label: "Won revenue",
            value: ((Number(campaign.stats.revenueMinorUnits) || 0) / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
            tone: "warning",
          },
        ]}
      />
      <WorkspaceQuickNav backHref="/campaigns" backLabel="Campaigns list" />

      <section className="card" style={{ padding: "var(--space-6)" }}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">Members</h2>
        <CampaignMemberPicker campaignId={campaign.id} canEdit={canEdit} members={campaign.members} />
      </section>
    </div>
  );
}
