import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { getLead, scopedContext } from "@/server/records/leads";
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
import { SendEmailButton } from "@/components/SendEmailButton";
import { LeadConvertControls } from "@/components/LeadConvertControls";
import { RecordWorkspaceTabs } from "@/components/RecordWorkspaceTabs";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";
import { getRecordCapabilities } from "@/lib/recordCapabilities";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>{label}</dt>
      <dd className="text-[13px] font-medium" style={{ color: value ? "var(--text-primary)" : "var(--text-tertiary)" }}>{value || "—"}</dd>
    </div>
  );
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  let lead;
  let events: Awaited<ReturnType<typeof listTimeline>> = [];
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
  let canConvert = false;
  let canAssign = false;
  let canChangeStatus = false;
  let canChangePotentialStatus = false;
  let canUpload = false;
  let canDeleteFiles = false;
  let canDelete = false;
  try {
    const ctx = await scopedContext("LEADS_VIEW");
    lead = await getLead(ctx, id);
    events = await listTimeline("LEAD", id);
    campaigns = await prisma.campaignMember.findMany({ where: { subjectType: "LEAD", subjectId: id }, include: { campaign: true } });
    tags = await listTagsForSubject(ctx, "LEAD", id);
    cfDefs = (await listCustomFields(true)).filter((def) => def.objectType === "LEAD");
    notes = await listNotesBySubject("LEAD", id);
    appointments = await listAppointmentsBySubject("LEAD", id);
    canViewEmails = ctx.permissions.includes("EMAILS_VIEW");
    const capabilities = getRecordCapabilities("LEAD", ctx.permissions);
    canEdit = capabilities.canEdit;
    canAddNote = capabilities.canAddNote;
    canCreateTask = capabilities.canCreateTask;
    canScheduleAppointment = capabilities.canScheduleAppointment;
    canConvert = capabilities.canConvert;
    canAssign = capabilities.canAssign;
    canChangeStatus = capabilities.canChangeStatus;
    canChangePotentialStatus = capabilities.canChangePotentialStatus;
    canUpload = ctx.permissions.includes("FILES_UPLOAD");
    canDeleteFiles = ctx.permissions.includes("FILES_DELETE");
    canDelete = ctx.permissions.includes("LEADS_DELETE");
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/leads");
    throw error;
  }

  const statusVariant =
    lead.status.category === "CONVERTED" ? "success" :
    lead.status.category === "LOST" ? "error" :
    lead.status.category === "INVALID" ? "warning" : "brand";

  const noteCount = notes.length;
  const appointmentCount = appointments.length;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <nav className="breadcrumb no-print" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="breadcrumb-sep">/</span>
        <Link href="/leads">Leads</Link><span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{lead.firstName} {lead.lastName}</span>
      </nav>
      <WorkspaceQuickNav backHref="/leads" backLabel="Leads list" />

      <RecordWorkspaceTabs
        type="leads"
        typeLabel="Leads"
        id={id}
        label={`${lead.firstName} ${lead.lastName}`}
        subtitle={[lead.status.name, lead.company].filter(Boolean).join(" · ")}
        href={`/leads/${id}`}
      />

      <HighlightsPanel
        title={`${lead.firstName} ${lead.lastName}`}
        badge={{ label: lead.status.name, variant: statusVariant as never }}
        fields={[
          { label: "Assignee", value: lead.assignedUser?.name ?? "Unassigned" },
          { label: "Company", value: lead.company },
          { label: "Score", value: lead.score > 0 ? `${lead.score}/100` : null },
          { label: "Priority", value: lead.priority },
          { label: "Email", value: lead.email },
          { label: "Phone", value: lead.phone },
        ]}
      >
        <SendEmailButton subjectType="LEAD" subjectId={id} email={lead.email} name={`${lead.firstName} ${lead.lastName}`} />
        <RecordDetailActions object="leads" row={lead as unknown as Record<string, unknown>} canEdit={canEdit} canDelete={canDelete} canAssign={canAssign} canChangeStatus={canChangeStatus} canChangePotentialStatus={canChangePotentialStatus} />
        <LeadConvertControls
          leadId={lead.id}
          convertedAt={lead.convertedAt?.toISOString() ?? null}
          convertedContactId={lead.convertedContactId}
          convertedCustomerId={lead.convertedCustomerId}
          canConvert={canConvert}
        />
      </HighlightsPanel>

      {/* Tabbed two-column: active tab left, timeline right */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <RecordPageTabs
            tabs={[
              { key: "overview", label: "Overview" },
              { key: "activity", label: "Activity", count: noteCount + appointmentCount },
              { key: "files", label: "Files" },
              ...(canViewEmails ? [{ key: "emails", label: "Emails" }] : []),
            ]}
          >
            {/* ── Overview tab ── */}
            <section className="card">
              <div className="card-header"><h2 className="card-title">Details</h2></div>
              <div className="card-body space-y-4">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Tags</p>
                  <TagEditor
                    subjectType="LEAD"
                    subjectId={id}
                    attached={tags.map((link) => ({ tagId: link.tagId, name: link.tag.name, color: link.tag.color }))}
                  />
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  <Field label="Secondary phone" value={lead.secondaryPhone} />
                  <Field label="Country" value={lead.country} />
                  <Field label="Region" value={lead.region} />
                  <Field label="Source" value={lead.source} />
                  <Field label="Campaign" value={lead.campaign?.name ?? (campaigns.map((entry) => entry.campaign.name).join(", ") || null)} />
                  <Field label="External ID" value={lead.externalId} />
                  <Field label="Last contact" value={lead.lastContactAt?.toLocaleDateString() ?? null} />
                  <Field label="Next follow-up" value={lead.nextFollowUpAt?.toLocaleDateString() ?? null} />
                  <Field label="Created" value={lead.createdAt.toLocaleDateString()} />
                  <CustomFieldsPanel defs={cfDefs} values={lead.customFields} />
                </dl>
              </div>
            </section>

            {/* ── Activity tab ── */}
            <section className="card">
              <div className="card-header"><h2 className="card-title">Activities</h2></div>
              <div className="card-body">
                <RecordActivities
                  subjectType="LEAD"
                  subjectId={id}
                  subjectLabel={`${lead.firstName} ${lead.lastName}`}
                  canAddNote={canAddNote}
                  canCreateTask={canCreateTask}
                  canScheduleAppointment={canScheduleAppointment}
                  notes={notes.map((note) => ({
                    id: note.id,
                    body: note.body,
                    createdAt: note.createdAt.toISOString(),
                    author: note.author,
                  }))}
                  appointments={appointments.map((appointment) => ({
                    id: appointment.id,
                    title: appointment.title,
                    startAt: appointment.startAt.toISOString(),
                    endAt: appointment.endAt?.toISOString() ?? null,
                    status: appointment.status,
                    locationOrLink: appointment.locationOrLink,
                  }))}
                />
              </div>
            </section>

            {/* ── Files tab ── */}
            <section className="card">
              <div className="card-header"><h2 className="card-title">Files</h2></div>
              <div className="card-body">
                <AttachmentsPanel subjectType="LEAD" subjectId={id} canUpload={canUpload} canDelete={canDeleteFiles} />
              </div>
            </section>
                    {canViewEmails ? (
            <RecordEmailHistory subjectType="LEAD" subjectId={id} />
          ) : null}
        </RecordPageTabs>
        </div>

        {/* Timeline sidebar (always visible) */}
        <aside className="no-print">
          <div className="card sticky top-17">
            <div className="card-header">
              <h2 className="card-title">Timeline</h2>
              <span className="badge badge-neutral">{events.length}</span>
            </div>
            <div className="mx-3 mt-3">
              <ActivityComposer subjectType="LEAD" subjectId={id} subjectLabel={`${lead.firstName} ${lead.lastName}`} canAddNote={canAddNote} canCreateTask={canCreateTask} canScheduleAppointment={canScheduleAppointment} />
            </div>
            <div className="card-body max-h-150 overflow-y-auto">
              <Timeline events={events} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
