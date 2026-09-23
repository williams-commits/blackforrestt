import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { getAccount } from "@/server/records/accounts";
import { scopedContext } from "@/server/records/leads";
import { listTimeline } from "@/server/activity";
import { listNotesBySubject } from "@/server/records/notes";
import { listAppointmentsBySubject } from "@/server/records/appointments";
import { Timeline } from "@/components/Timeline";
import { ActivityComposer } from "@/components/ActivityComposer";
import { HighlightsPanel } from "@/components/HighlightsPanel";
import { RecordPageTabs } from "@/components/RecordPageTabs";
import { RecordEmailHistory } from "@/components/RecordEmailHistory";
import { TagEditor } from "@/components/TagEditor";
import { CustomFieldsPanel } from "@/components/CustomFieldsPanel";
import { listTagsForSubject } from "@/server/records/tags";
import { listCustomFields } from "@/server/records/customFields";
import { RecordActivities } from "@/components/RecordActivities";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { RecordDetailActions } from "@/components/RecordDetailActions";
import { EmptyState } from "@/components/ui";
import { RecordWorkspaceTabs } from "@/components/RecordWorkspaceTabs";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";
import { getRecordCapabilities } from "@/lib/recordCapabilities";

import { DetailField } from "@/components/DetailOverview";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function AccountDetailPage({ params }: PageProps) {
  const { id } = await params;
  let account;
  let events: Awaited<ReturnType<typeof listTimeline>> = [];
  let relatedOpportunities: Array<{ id: string; name: string; status: string; stage: { name: string } }> = [];
  let campaigns: Array<{ campaign: { name: string } }> = [];
  let tags: Awaited<ReturnType<typeof listTagsForSubject>> = [];
  let cfDefs: Awaited<ReturnType<typeof listCustomFields>> = [];
  let notes: Awaited<ReturnType<typeof listNotesBySubject>> = [];
  let appointments: Awaited<ReturnType<typeof listAppointmentsBySubject>> = [];
  let canViewEmails = false;
  let canEdit = false;
  let canAddNote = false;
  let canCreateTask = false;
  let canScheduleAppointment = false;
  let canAssign = false;
  let canChangeStatus = false;
  let canUpload = false;
  let canDeleteFiles = false;
  let canDelete = false;
  try {
    const ctx = await scopedContext("ACCOUNTS_VIEW");
    account = await getAccount(ctx, id);
    events = await listTimeline("ACCOUNT", id);
    relatedOpportunities = await prisma.opportunity.findMany({
      where: { accountId: id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, status: true, stage: { select: { name: true } } },
    });
    campaigns = await prisma.campaignMember.findMany({ where: { subjectType: "ACCOUNT", subjectId: id }, include: { campaign: true } });
    tags = await listTagsForSubject(ctx, "ACCOUNT", id);
    cfDefs = (await listCustomFields(true)).filter((def) => def.objectType === "ACCOUNT");
    notes = await listNotesBySubject("ACCOUNT", id);
    appointments = await listAppointmentsBySubject("ACCOUNT", id);
    canViewEmails = ctx.permissions.includes("EMAILS_VIEW");
    const capabilities = getRecordCapabilities("ACCOUNT", ctx.permissions);
    canEdit = capabilities.canEdit;
    canAddNote = capabilities.canAddNote;
    canCreateTask = capabilities.canCreateTask;
    canScheduleAppointment = capabilities.canScheduleAppointment;
    canAssign = capabilities.canAssign;
    canChangeStatus = capabilities.canChangeStatus;
    canUpload = ctx.permissions.includes("FILES_UPLOAD");
    canDeleteFiles = ctx.permissions.includes("FILES_DELETE");
    canDelete = ctx.permissions.includes("ACCOUNTS_DELETE");
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/accounts");
    throw error;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4" data-module="accounts">
      <nav className="breadcrumb no-print" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="breadcrumb-sep">/</span>
        <Link href="/accounts">Accounts</Link><span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{account.name}</span>
      </nav>
      <WorkspaceQuickNav backHref="/accounts" backLabel="Accounts list" />

      <RecordWorkspaceTabs
        type="accounts"
        typeLabel="Accounts"
        id={id}
        label={account.name}
        subtitle={[account.industry, account.country].filter(Boolean).join(" · ")}
        href={`/accounts/${id}`}
      />

      <HighlightsPanel
        title={account.name}
        fields={[
          { label: "Owner", value: account.owner?.name },
          { label: "Industry", value: account.industry },
          { label: "Country", value: account.country },
          { label: "Revenue", value: account.revenue ? (Number(account.revenue) / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : null },
          { label: "Website", value: account.website },
          { label: "Team", value: account.team?.name },
        ]}
      >
        <RecordDetailActions object="accounts" row={account as unknown as Record<string, unknown>} canEdit={canEdit} canDelete={canDelete} canAssign={canAssign} canChangeStatus={canChangeStatus} />
      </HighlightsPanel>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <RecordPageTabs
            tabs={[
              { key: "overview", label: "Overview" },
              { key: "contacts", label: "Contacts", count: account.contacts.length },
              { key: "opportunities", label: "Opportunities", count: relatedOpportunities.length },
              { key: "activity", label: "Activity", count: notes.length + appointments.length },
              { key: "files", label: "Files" },
              ...(canViewEmails ? [{ key: "emails", label: "Emails" }] : []),
            ]}
          >
          {/* Overview */}
          <section className="card">
            <div className="card-header"><h2 className="card-title">Details</h2></div>
            <div className="card-body space-y-4">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Tags</p>
                <TagEditor
                  subjectType="ACCOUNT"
                  subjectId={id}
                  attached={tags.map((link) => ({ tagId: link.tagId, name: link.tag.name, color: link.tag.color }))}
                />
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <DetailField label="Industry" value={account.industry} />
                <DetailField label="Company Size" value={account.companySize} />
                <DetailField label="Revenue" value={account.revenue ? (Number(account.revenue) / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : null} />
                <DetailField
                  label="Website"
                  value={
                    account.website ? (
                      <a href={account.website} target="_blank" rel="noreferrer" className="font-medium hover:underline" style={{ color: "var(--text-brand)" }}>
                        {account.website}
                      </a>
                    ) : null
                  }
                />
                <DetailField label="City" value={account.city} />
                <DetailField label="Country" value={account.country} />
                <DetailField label="External ID" value={account.externalId} />
                <DetailField label="Created" value={account.createdAt.toLocaleDateString()} />
                <CustomFieldsPanel defs={cfDefs} values={account.customFields} />
              </dl>
            </div>
          </section>

          {/* Contacts */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Contacts</h2>
              <div className="flex items-center gap-2">
                <span className="badge badge-neutral">{account.contacts.length}</span>
                <Link href="/contacts" className="text-[12px] font-medium hover:underline" style={{ color: "var(--text-brand)" }}>
                  View All →
                </Link>
              </div>
            </div>
            <div className="card-body">
              {account.contacts.length === 0 ? (
                <EmptyState
                  title="No contacts linked yet"
                  description="Contacts belonging to this account will appear here."
                />
              ) : (
                <ul className="space-y-2">
                  {account.contacts.map((contact) => (
                    <li key={contact.id} className="flex items-center justify-between text-[13px]">
                      <Link href={`/contacts/${contact.id}`} className="font-medium hover:underline" style={{ color: "var(--text-brand)" }}>
                        {contact.firstName} {contact.lastName}
                      </Link>
                      <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                        {contact.jobTitle ?? contact.email ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Opportunities */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Opportunities</h2>
              <div className="flex items-center gap-2">
                <span className="badge badge-neutral">{relatedOpportunities.length}</span>
                <Link href="/opportunities" className="text-[12px] font-medium hover:underline" style={{ color: "var(--text-brand)" }}>
                  View All →
                </Link>
              </div>
            </div>
            <div className="card-body">
              {relatedOpportunities.length === 0 ? (
                <EmptyState
                  title="No opportunities yet"
                  description="Deals linked to this account will appear here."
                />
              ) : (
                <ul className="space-y-2">
                  {relatedOpportunities.map((opportunity) => (
                    <li key={opportunity.id} className="flex items-center justify-between text-[13px]">
                      <Link href={`/opportunities/${opportunity.id}`} className="font-medium hover:underline" style={{ color: "var(--text-brand)" }}>
                        {opportunity.name}
                      </Link>
                      <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                        {opportunity.stage.name} · {opportunity.status.toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {campaigns.length > 0 ? (
                <p className="mt-3 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  Campaigns: {campaigns.map((entry) => entry.campaign.name).join(", ")}
                </p>
              ) : null}
            </div>
          </section>

          {/* Activities */}
          <section className="card">
            <div className="card-header"><h2 className="card-title">Activities</h2></div>
            <div className="card-body">
              <RecordActivities
                subjectType="ACCOUNT"
                subjectId={id}
                subjectLabel={account.name}
                canAddNote={canAddNote}
                canCreateTask={canCreateTask}
                canScheduleAppointment={canScheduleAppointment}
                notes={notes.map((note) => ({ id: note.id, body: note.body, createdAt: note.createdAt.toISOString(), author: note.author }))}
                appointments={appointments.map((appointment) => ({ id: appointment.id, title: appointment.title, startAt: appointment.startAt.toISOString(), endAt: appointment.endAt?.toISOString() ?? null, status: appointment.status, locationOrLink: appointment.locationOrLink }))}
              />
            </div>
          </section>

          {/* Files */}
          <section className="card">
            <div className="card-header"><h2 className="card-title">Files</h2></div>
            <div className="card-body">
              <AttachmentsPanel subjectType="ACCOUNT" subjectId={id} canUpload={canUpload} canDelete={canDeleteFiles} />
            </div>
          </section>
            {canViewEmails ? (
              <RecordEmailHistory subjectType="ACCOUNT" subjectId={id} />
            ) : null}
          </RecordPageTabs>
        </div>

        {/* Timeline sidebar */}
        <aside className="no-print">
          <div className="card lg:sticky lg:top-17">
            <div className="card-header">
              <h2 className="card-title flex items-center gap-1.5"><Icon name="clock" size={14} className="text-muted-foreground" />Timeline</h2>
              <span className="badge badge-neutral tabular-nums">{events.length}</span>
            </div>
            <div className="mx-3 mt-3">
              <ActivityComposer subjectType="ACCOUNT" subjectId={id} subjectLabel={account.name} canAddNote={canAddNote} canCreateTask={canCreateTask} canScheduleAppointment={canScheduleAppointment} />
            </div>
            <div className="card-body max-h-[70vh] overflow-y-auto">
              <Timeline events={events} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
