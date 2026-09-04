import { redirect } from "next/navigation";
import { CrmError } from "@/server/guard";
import { getCampaign } from "@/server/records/campaigns";
import { scopedContext } from "@/server/records/leads";
import { CampaignMemberPicker } from "@/components/CampaignMemberPicker";

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
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="card" style={{ padding: "var(--space-6)" }}>
        <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Campaign</p>
        <h1 className="text-xl font-semibold">{campaign.name}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {campaign.status.toLowerCase()} · owner {campaign.owner.name}
          {campaign.source ? ` · source ${campaign.source}` : ""}
        </p>
        {campaign.description ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{campaign.description}</p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-7">
          <div className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
            <p className="text-xl font-semibold">{campaign.stats.total}</p>
            <p className="text-xs text-[var(--text-secondary)]">members</p>
          </div>
          <div className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
            <p className="text-xl font-semibold">{campaign.stats.responded}</p>
            <p className="text-xs text-[var(--text-secondary)]">responded</p>
          </div>
          <div className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
            <p className="text-xl font-semibold">{campaign.stats.byStatus?.QUALIFIED ?? 0}</p>
            <p className="text-xs text-[var(--text-secondary)]">qualified</p>
          </div>
          <div className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
            <p className="text-xl font-semibold">{campaign.stats.byStatus?.CONVERTED ?? 0}</p>
            <p className="text-xs text-[var(--text-secondary)]">converted</p>
          </div>
          <div className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
            <p className="text-xl font-semibold">
              {((Number(campaign.stats.revenueMinorUnits) || 0) / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">won revenue</p>
          </div>
          <div className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
            <p className="text-xl font-semibold">{campaign.stats.byType.LEAD}</p>
            <p className="text-xs text-[var(--text-secondary)]">leads</p>
          </div>
          <div className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
            <p className="text-xl font-semibold">{campaign.stats.byType.CONTACT + campaign.stats.byType.CUSTOMER}</p>
            <p className="text-xs text-[var(--text-secondary)]">contacts + customers</p>
          </div>
        </div>
      </header>

      <section className="card" style={{ padding: "var(--space-6)" }}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Members</h2>
        <CampaignMemberPicker campaignId={campaign.id} canEdit={canEdit} members={campaign.members} />
      </section>
    </div>
  );
}
