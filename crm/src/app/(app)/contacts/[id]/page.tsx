import Link from "next/link";
import { listRelatedOpportunities } from "@/server/records/opportunities";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { getContact } from "@/server/records/contacts";
import { scopedContext } from "@/server/records/leads";
import { listTimeline } from "@/server/activity";
import { listNotesBySubjectPage } from "@/server/records/notes";
import { listAppointmentsBySubjectPage } from "@/server/records/appointments";
import { ACTIVITY_STRIP_PAGE_SIZE } from "@/lib/activityStrip";
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

export default async function ContactDetailPage({ params }: PageProps) {
  const { id } = await params;
  let contact;
  let events: Awaited<ReturnType<typeof listTimeline>> = [];
  let tags: Awaited<ReturnType<typeof listTagsForSubject>> = [];
  let cfDefs: Awaited<ReturnType<typeof listCustomFields>> = [];
  let notes: Awaited<ReturnType<typeof listNotesBySubjectPage>> = { rows: [], total: 0 };
  let appointments: Awaited<ReturnType<typeof listAppointmentsBySubjectPage>> = { rows: [], total: 0 };
  let relatedOpportunities: Array<{
    id: string;
    name: string;
    status: string;
    value: unknown;
    currency: string;
    contactId: string | null;
    accountId: string | null;
    stage: { name: string };
  }> = [];
  let campaigns: Array<{ campaign: { name: string } }> = [];
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
    const ctx = await scopedContext("CONTACTS_VIEW");
    contact = await getContact(ctx, id);
    events = await listTimeline("CONTACT", id);
    tags = await listTagsForSubject(ctx, "CONTACT", id);
    cfDefs = (await listCustomFields(true)).filter((def) => def.objectType === "CONTACT");
    notes = await listNotesBySubjectPage("CONTACT", id, 1, ACTIVITY_STRIP_PAGE_SIZE);
    appointments = await listAppointmentsBySubjectPage("CONTACT", id, 1, ACTIVITY_STRIP_PAGE_SIZE);
    relatedOpportunities = await listRelatedOpportunities(
      ctx,
      { contactId: id, ...(contact.accountId ? { accountId: contact.accountId } : {}) },
    );
    campaigns = await prisma.campaignMember.findMany({ where: { subjectType: "CONTACT", subjectId: id }, include: { campaign: true } });
    canViewEmails = ctx.permissions.includes("EMAILS_VIEW");
    const capabilities = getRecordCapabilities("CONTACT", ctx.permissions);
    canEdit = capabilities.canEdit;
    canAddNote = capabilities.canAddNote;
    canCreateTask = capabilities.canCreateTask;
    canScheduleAppointment = capabilities.canScheduleAppointment;
    canAssign = capabilities.canAssign;
    canChangeStatus = capabilities.canChangeStatus;
    canUpload = ctx.permissions.includes("FILES_UPLOAD");
    canDeleteFiles = ctx.permissions.includes("FILES_DELETE");
    canDelete = ctx.permissions.includes("CONTACTS_DELETE");
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/contacts");
    throw error;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4" data-module="contacts">
      <nav className="breadcrumb no-print" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="breadcrumb-sep">/</span>
        <Link href="/contacts">Contacts</Link><span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{contact.firstName} {contact.lastName}</span>
      </nav>
      <WorkspaceQuickNav backHref="/contacts" backLabel="Contacts list" />

      <RecordWorkspaceTabs
        type="contacts"
        typeLabel="Contacts"
        id={id}
        label={`${contact.firstName} ${contact.lastName}`}
        subtitle={[contact.account?.name, contact.email].filter(Boolean).join(" · ")}
        href={`/contacts/${id}`}
      />

      <HighlightsPanel
        title={`${contact.firstName} ${contact.lastName}`}
        badge={contact.status ? { label: contact.status.name, variant: "brand" as never, color: contact.status.color } : undefined}
        fields={[
          { label: "Owner", value: contact.owner.name },
          { label: "Account", value: contact.account?.name },
          { label: "Job Title", value: contact.jobTitle },
          { label: "Email", value: contact.email },
          { label: "Phone", value: contact.phone },
        ]}
      >
        <RecordDetailActions object="contacts" row={contact as unknown as Record<string, unknown>} canEdit={canEdit} canDelete={canDelete} canAssign={canAssign} canChangeStatus={canChangeStatus} 
          email={{ subjectType: "CONTACT", subjectId: id, to: contact.email, name: `${contact.firstName} ${contact.lastName}` }}
        />
      </HighlightsPanel>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <RecordPageTabs
            tabs={[
              { key: "overview", label: "Overview" },
              { key: "opportunities", label: "Opportunities", count: relatedOpportunities.length },
              { key: "activity", label: "Activity", count: notes.total + appointments.total },
              { key: "files", label: "Files" },
              ...(canViewEmails ? [{ key: "emails", label: "Emails" }] : []),
            ]}
          >
          <section className="card">
            <div className="card-header"><h2 className="card-title flex items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden><Icon name="list" size={13} /></span>Details</h2></div>
            <div className="card-body space-y-4">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Tags</p>
                <TagEditor subjectType="CONTACT" subjectId={id} attached={tags.map((link) => ({ tagId: link.tagId, name: link.tag.name, color: link.tag.color }))} />
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <DetailField label="Lead Source" value={contact.leadSource} />
                <DetailField label="Campaign" value={campaigns.map((entry) => entry.campaign.name).join(", ") || null} />
                <DetailField label="External ID" value={contact.externalId} />
                <DetailField label="Team" value={contact.team?.name} />
                <DetailField label="Created" value={contact.createdAt.toLocaleDateString()} />
                <CustomFieldsPanel defs={cfDefs} values={contact.customFields} />
              </dl>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2 className="card-title flex items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden><Icon name="trending" size={13} /></span>Opportunities</h2>
            </div>
            <div className="card-body">
              {relatedOpportunities.length === 0 ? (
                <EmptyState
                  icon="trending"
                  title="No opportunities yet"
                  description="Deals linked to this contact or their account will appear here."
                  className="py-8"
                />
              ) : (
                <ul className="space-y-2.5">
                  {relatedOpportunities.map((opportunity) => (
                    <li key={opportunity.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-xs transition-colors hover:border-border/80 hover:bg-muted/30">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden>
                        <Icon name="trending" size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <Link href={`/opportunities/${opportunity.id}`} className="block truncate font-medium text-foreground hover:text-primary hover:underline">
                          {opportunity.name}
                        </Link>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {opportunity.contactId === id ? "Contact deal" : "Account deal"} · {opportunity.stage.name} · {opportunity.status.toLowerCase()}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                        {opportunity.value
                          ? (Number(opportunity.value) / 100).toLocaleString(undefined, {
                              style: "currency",
                              currency: opportunity.currency,
                              maximumFractionDigits: 0,
                            })
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card-title flex items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden><Icon name="clock" size={13} /></span>Activities</h2></div>
            <div className="card-body">
              <RecordActivities
                subjectType="CONTACT"
                subjectId={id}
                subjectLabel={`${contact.firstName} ${contact.lastName}`}
                canAddNote={canAddNote}
                canCreateTask={canCreateTask}
                canScheduleAppointment={canScheduleAppointment}
                notes={notes.rows.map((note) => ({ id: note.id, body: note.body, createdAt: note.createdAt.toISOString(), editedAt: note.editedAt?.toISOString() ?? null, author: note.author }))}
                notesTotal={notes.total}
                appointments={appointments.rows.map((appointment) => ({ id: appointment.id, title: appointment.title, startAt: appointment.startAt.toISOString(), endAt: appointment.endAt?.toISOString() ?? null, status: appointment.status, locationOrLink: appointment.locationOrLink }))}
                appointmentsTotal={appointments.total}
              />
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card-title flex items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden><Icon name="folder" size={13} /></span>Files</h2></div>
            <div className="card-body">
              <AttachmentsPanel subjectType="CONTACT" subjectId={id} canUpload={canUpload} canDelete={canDeleteFiles} />
            </div>
          </section>
            {canViewEmails ? (
              <RecordEmailHistory subjectType="CONTACT" subjectId={id} />
            ) : null}
          </RecordPageTabs>
        </div>

        <aside className="no-print">
          <div className="card lg:sticky lg:top-17">
            <div className="card-header">
              <h2 className="card-title flex items-center gap-1.5"><Icon name="clock" size={14} className="text-muted-foreground" />Timeline</h2>
              <span className="badge badge-neutral tabular-nums">{events.length}</span>
            </div>
            <div className="mx-3 mt-3">
              <ActivityComposer subjectType="CONTACT" subjectId={id} subjectLabel={`${contact.firstName} ${contact.lastName}`} canAddNote={canAddNote} canCreateTask={canCreateTask} canScheduleAppointment={canScheduleAppointment} />
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
