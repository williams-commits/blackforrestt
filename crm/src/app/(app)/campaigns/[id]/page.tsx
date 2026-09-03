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
      <header className="rounded-lg border border-stone-200 bg-white p-6">
        <p className="text-xs uppercase tracking-wide text-stone-400">Campaign</p>
        <h1 className="text-xl font-semibold">{campaign.name}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {campaign.status.toLowerCase()} · owner {campaign.owner.name}
          {campaign.source ? ` · source ${campaign.source}` : ""}
        </p>
        {campaign.description ? (
          <p className="mt-2 text-sm text-stone-600">{campaign.description}</p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-md border border-stone-100 bg-stone-50 p-3">
            <p className="text-xl font-semibold">{campaign.stats.total}</p>
            <p className="text-xs text-stone-500">members</p>
          </div>
          <div className="rounded-md border border-stone-100 bg-stone-50 p-3">
            <p className="text-xl font-semibold">{campaign.stats.responded}</p>
            <p className="text-xs text-stone-500">responded</p>
          </div>
          <div className="rounded-md border border-stone-100 bg-stone-50 p-3">
            <p className="text-xl font-semibold">{campaign.stats.byType.LEAD}</p>
            <p className="text-xs text-stone-500">leads</p>
          </div>
          <div className="rounded-md border border-stone-100 bg-stone-50 p-3">
            <p className="text-xl font-semibold">{campaign.stats.byType.CONTACT + campaign.stats.byType.CUSTOMER}</p>
            <p className="text-xs text-stone-500">contacts + customers</p>
          </div>
        </div>
      </header>

      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Members</h2>
        <CampaignMemberPicker campaignId={campaign.id} canEdit={canEdit} members={campaign.members} />
      </section>
    </div>
  );
}
