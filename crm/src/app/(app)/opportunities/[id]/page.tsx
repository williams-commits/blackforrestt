import Link from "next/link";
import { redirect } from "next/navigation";
import { CrmError } from "@/server/guard";
import { getOpportunity } from "@/server/records/opportunities";
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
import { OpportunityDetailActions } from "@/components/OpportunityDetailActions";
import { RecordWorkspaceTabs } from "@/components/RecordWorkspaceTabs";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";
import { getRecordCapabilities } from "@/lib/recordCapabilities";

import { DetailField } from "@/components/DetailOverview";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function OpportunityDetailPage({ params }: PageProps) {
  const { id } = await params;
  let opportunity;
  let events: Awaited<ReturnType<typeof listTimeline>> = [];
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
  let canDelete = false;
  try {
    const ctx = await scopedContext("OPPORTUNITIES_VIEW");
    opportunity = await getOpportunity(ctx, id);
    events = await listTimeline("OPPORTUNITY", id);
    tags = await listTagsForSubject(ctx, "OPPORTUNITY", id);
    cfDefs = (await listCustomFields(true)).filter((def) => def.objectType === "OPPORTUNITY");
    notes = await listNotesBySubject("OPPORTUNITY", id);
    appointments = await listAppointmentsBySubject("OPPORTUNITY", id);
    canViewEmails = ctx.permissions.includes("EMAILS_VIEW");
    const capabilities = getRecordCapabilities("OPPORTUNITY", ctx.permissions);
    canEdit = capabilities.canEdit;
    canAddNote = capabilities.canAddNote;
    canCreateTask = capabilities.canCreateTask;
    canScheduleAppointment = capabilities.canScheduleAppointment;
    canAssign = capabilities.canAssign;
    canChangeStatus = capabilities.canChangeStatus;
    canDelete = ctx.permissions.includes("OPPORTUNITIES_DELETE");
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/opportunities");
    throw error;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4" data-module="opportunities">
      <nav className="breadcrumb no-print" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="breadcrumb-sep">/</span>
        <Link href="/opportunities">Opportunities</Link><span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{opportunity.name}</span>
      </nav>
      <WorkspaceQuickNav backHref="/opportunities" backLabel="Opportunities list" />

      <RecordWorkspaceTabs
        type="opportunities"
        typeLabel="Opportunities"
        id={id}
        label={opportunity.name}
        subtitle={[
          opportunity.stage.name,
          opportunity.value
            ? (Number(opportunity.value) / 100).toLocaleString(undefined, {
                style: "currency",
                currency: opportunity.currency,
                maximumFractionDigits: 0,
              })
            : null,
        ].filter(Boolean).join(" · ")}
        href={`/opportunities/${id}`}
      />

      <HighlightsPanel
        title={opportunity.name}
        badge={{ label: opportunity.stage.name, variant: opportunity.status === "WON" ? "success" : opportunity.status === "LOST" ? "error" : "brand" }}
        fields={[
          { label: "Pipeline", value: opportunity.pipeline.name },
          { label: "Stage", value: opportunity.stage.name },
          { label: "Owner", value: opportunity.owner?.name },
          { label: "Value", value: opportunity.value ? (Number(opportunity.value) / 100).toLocaleString(undefined, { style: "currency", currency: opportunity.currency, maximumFractionDigits: 0 }) : null },
          { label: "Probability", value: `${opportunity.probability}%` },
          { label: "Close Date", value: opportunity.expectedCloseAt?.toLocaleDateString() },
        ]}
      >
        <OpportunityDetailActions row={opportunity as unknown as Record<string, unknown>} canEdit={canEdit} canDelete={canDelete} canAssign={canAssign} canChangeStatus={canChangeStatus} />
      </HighlightsPanel>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <RecordPageTabs
            tabs={[
              { key: "overview", label: "Overview" },
              { key: "activity", label: "Activity", count: notes.length + appointments.length },
              { key: "files", label: "Files" },
              ...(canViewEmails ? [{ key: "emails", label: "Emails" }] : []),
            ]}
          >
          {/* Details */}
          <section className="card">
            <div className="card-header"><h2 className="card-title">Details</h2></div>
            <div className="card-body space-y-4">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Tags</p>
                <TagEditor
                  subjectType="OPPORTUNITY"
                  subjectId={id}
                  attached={tags.map((link) => ({ tagId: link.tagId, name: link.tag.name, color: link.tag.color }))}
                />
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <DetailField
                  label="Account"
                  value={
                    opportunity.account ? (
                      <Link href={`/accounts/${opportunity.account.id}`} className="font-medium hover:underline" style={{ color: "var(--text-brand)" }}>
                        {opportunity.account.name}
                      </Link>
                    ) : null
                  }
                />
                <DetailField
                  label="Contact"
                  value={
                    opportunity.contact ? (
                      <Link href={`/contacts/${opportunity.contact.id}`} className="font-medium hover:underline" style={{ color: "var(--text-brand)" }}>
                        {opportunity.contact.firstName} {opportunity.contact.lastName}
                      </Link>
                    ) : null
                  }
                />
                <DetailField label="Team" value={opportunity.team?.name} />
                <DetailField label="Source" value={opportunity.source} />
                <DetailField label="Expected Close" value={opportunity.expectedCloseAt?.toLocaleDateString() ?? null} />
                <DetailField label="Closed" value={opportunity.closedAt?.toLocaleDateString() ?? null} />
                <DetailField label="Created" value={opportunity.createdAt.toLocaleDateString()} />
                <CustomFieldsPanel defs={cfDefs} values={opportunity.customFields} />
              </dl>
            </div>
          </section>

          {/* Activities */}
          <section className="card">
            <div className="card-header"><h2 className="card-title">Activities</h2></div>
            <div className="card-body">
              <RecordActivities
                subjectType="OPPORTUNITY"
                subjectId={id}
                subjectLabel={opportunity.name}
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
              <AttachmentsPanel subjectType="OPPORTUNITY" subjectId={id} canUpload={canEdit} canDelete={canDelete} />
            </div>
          </section>
            {canViewEmails ? (
              <RecordEmailHistory subjectType="OPPORTUNITY" subjectId={id} />
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
              <ActivityComposer subjectType="OPPORTUNITY" subjectId={id} subjectLabel={opportunity.name} canAddNote={canAddNote} canCreateTask={canCreateTask} canScheduleAppointment={canScheduleAppointment} />
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
