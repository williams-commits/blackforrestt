import Link from "next/link";
import { redirect } from "next/navigation";
import { CrmError } from "@/server/guard";
import { getCampaign } from "@/server/records/campaigns";
import { scopedContext } from "@/server/records/leads";
import { CampaignMemberPicker } from "@/components/CampaignMemberPicker";
import { HighlightsPanel } from "@/components/HighlightsPanel";
import { RecordPageTabs } from "@/components/RecordPageTabs";
import { RecordDetailActions } from "@/components/RecordDetailActions";
import { RecordWorkspaceTabs } from "@/components/RecordWorkspaceTabs";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";

import { DetailField } from "@/components/DetailOverview";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

const STATUS_VARIANT: Record<string, "success" | "warning" | "error" | "info" | "neutral" | "brand"> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "info",
};

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;
  let campaign;
  let canEdit = false;
  let canDelete = false;
  try {
    const ctx = await scopedContext("CAMPAIGNS_VIEW");
    campaign = await getCampaign(ctx, id);
    canEdit = ctx.permissions.includes("CAMPAIGNS_EDIT");
    canDelete = ctx.permissions.includes("CAMPAIGNS_DELETE");
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/campaigns");
    throw error;
  }

  const wonRevenue = ((Number(campaign.stats.revenueMinorUnits) || 0) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4" data-module="campaigns">
      <nav className="breadcrumb no-print" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="breadcrumb-sep">/</span>
        <Link href="/campaigns">Campaigns</Link><span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{campaign.name}</span>
      </nav>
      <WorkspaceQuickNav backHref="/campaigns" backLabel="Campaigns list" />

      <RecordWorkspaceTabs
        type="campaigns"
        typeLabel="Campaigns"
        id={id}
        label={campaign.name}
        subtitle={[campaign.status.toLowerCase(), campaign.source].filter(Boolean).join(" · ")}
        href={`/campaigns/${id}`}
      />

      <HighlightsPanel
        title={campaign.name}
        badge={{ label: campaign.status.toLowerCase(), variant: STATUS_VARIANT[campaign.status] ?? "brand" }}
        fields={[
          { label: "Owner", value: campaign.owner.name },
          { label: "Source", value: campaign.source },
          { label: "Starts", value: campaign.startsAt?.toLocaleDateString() ?? null },
          { label: "Ends", value: campaign.endsAt?.toLocaleDateString() ?? null },
          { label: "Members", value: campaign.stats.total > 0 ? `${campaign.stats.total}` : null },
          { label: "Won revenue", value: campaign.stats.total > 0 ? wonRevenue : null },
        ]}
      >
        <RecordDetailActions object="campaigns" row={campaign as unknown as Record<string, unknown>} canEdit={canEdit} canDelete={canDelete} />
      </HighlightsPanel>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <RecordPageTabs
            tabs={[
              { key: "overview", label: "Overview" },
              { key: "members", label: "Members", count: campaign.stats.total },
            ]}
          >
            {/* ── Overview tab ── */}
            <section className="card">
              <div className="card-header"><h2 className="card-title">Details</h2></div>
              <div className="card-body space-y-4">
                {campaign.description ? (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Description</p>
                    <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed" style={{ color: "var(--text-primary)" }}>
                      {campaign.description}
                    </p>
                  </div>
                ) : null}
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <DetailField label="Status" value={campaign.status.toLowerCase()} />
                  <DetailField label="Source" value={campaign.source} />
                  <DetailField label="Owner" value={campaign.owner.name} />
                  <DetailField label="Starts" value={campaign.startsAt?.toLocaleDateString() ?? null} />
                  <DetailField label="Ends" value={campaign.endsAt?.toLocaleDateString() ?? null} />
                  <DetailField label="Created" value={campaign.createdAt.toLocaleDateString()} />
                  <DetailField label="Updated" value={campaign.updatedAt.toLocaleDateString()} />
                </dl>
              </div>
            </section>

            {/* ── Members tab ── */}
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Members</h2>
                <span className="badge badge-neutral">{campaign.stats.total}</span>
              </div>
              <div className="card-body">
                <CampaignMemberPicker campaignId={campaign.id} canEdit={canEdit} members={campaign.members} />
              </div>
            </section>
          </RecordPageTabs>
        </div>

        {/* Stats sidebar */}
        <aside className="no-print">
          <div className="card lg:sticky lg:top-17">
            <div className="card-header">
              <h2 className="card-title">Stats</h2>
              <span className="badge badge-neutral">{campaign.stats.total}</span>
            </div>
            <div className="card-body">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <DetailField label="Responded" value={`${campaign.stats.responded}`} />
                <DetailField label="Qualified" value={`${campaign.stats.byStatus?.QUALIFIED ?? 0}`} />
                <DetailField label="Converted" value={`${campaign.stats.byStatus?.CONVERTED ?? 0}`} />
                <DetailField label="Won revenue" value={campaign.stats.total > 0 ? wonRevenue : null} />
                <DetailField label="Leads" value={`${campaign.stats.byType?.LEAD ?? 0}`} />
                <DetailField label="Contacts" value={`${campaign.stats.byType?.CONTACT ?? 0}`} />
                <DetailField label="Customers" value={`${campaign.stats.byType?.CUSTOMER ?? 0}`} />
              </dl>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
