import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { getContact } from "@/server/records/contacts";
import { scopedContext } from "@/server/records/leads";
import { listTimeline } from "@/server/activity";
import { listNotesBySubject } from "@/server/records/notes";
import { listAppointmentsBySubject } from "@/server/records/appointments";
import { Timeline } from "@/components/Timeline";
import { HighlightsPanel } from "@/components/HighlightsPanel";
import { TagEditor } from "@/components/TagEditor";
import { CustomFieldsPanel } from "@/components/CustomFieldsPanel";
import { listTagsForSubject } from "@/server/records/tags";
import { listCustomFields } from "@/server/records/customFields";
import { RecordActivities } from "@/components/RecordActivities";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { RecordDetailActions } from "@/components/RecordDetailActions";
import { SendEmailButton } from "@/components/SendEmailButton";

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

export default async function ContactDetailPage({ params }: PageProps) {
  const { id } = await params;
  let contact;
  let events: Awaited<ReturnType<typeof listTimeline>> = [];
  let tags: Awaited<ReturnType<typeof listTagsForSubject>> = [];
  let cfDefs: Awaited<ReturnType<typeof listCustomFields>> = [];
  let notes: Awaited<ReturnType<typeof listNotesBySubject>> = [];
  let appointments: Awaited<ReturnType<typeof listAppointmentsBySubject>> = [];
  let relatedOpportunities: Array<{ id: string; name: string; status: string; stage: { name: string } }> = [];
  let campaigns: Array<{ campaign: { name: string } }> = [];
  let canEdit = false;
  let canUpload = false;
  let canDeleteFiles = false;
  let canDelete = false;
  try {
    const ctx = await scopedContext("CONTACTS_READ");
    contact = await getContact(ctx, id);
    events = await listTimeline("CONTACT", id);
    tags = await listTagsForSubject("CONTACT", id);
    cfDefs = (await listCustomFields(true)).filter((def) => def.objectType === "CONTACT");
    notes = await listNotesBySubject("CONTACT", id);
    appointments = await listAppointmentsBySubject("CONTACT", id);
    relatedOpportunities = await prisma.opportunity.findMany({
      where: { contactId: id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, status: true, stage: { select: { name: true } } },
    });
    campaigns = await prisma.campaignMember.findMany({ where: { subjectType: "CONTACT", subjectId: id }, include: { campaign: true } });
    canEdit = ctx.permissions.includes("CONTACTS_EDIT");
    canUpload = ctx.permissions.includes("FILES_UPLOAD");
    canDeleteFiles = ctx.permissions.includes("FILES_DELETE");
    canDelete = ctx.permissions.includes("CONTACTS_DELETE");
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/contacts");
    throw error;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <nav className="breadcrumb no-print" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="breadcrumb-sep">/</span>
        <Link href="/contacts">Contacts</Link><span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{contact.firstName} {contact.lastName}</span>
      </nav>

      <HighlightsPanel
        title={`${contact.firstName} ${contact.lastName}`}
        badge={contact.status ? { label: contact.status.name, variant: "brand" as never } : undefined}
        fields={[
          { label: "Owner", value: contact.owner.name },
          { label: "Account", value: contact.account?.name },
          { label: "Job Title", value: contact.jobTitle },
          { label: "Email", value: contact.email },
          { label: "Phone", value: contact.phone },
        ]}
      >
        <SendEmailButton subjectType="CONTACT" subjectId={id} email={contact.email} name={`${contact.firstName} ${contact.lastName}`} />
        <RecordDetailActions object="contacts" row={contact as unknown as Record<string, unknown>} canEdit={canEdit} canDelete={canDelete} />
      </HighlightsPanel>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <section className="card">
            <div className="card-header"><h2 className="card-title">Details</h2></div>
            <div className="card-body space-y-4">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Tags</p>
                <TagEditor subjectType="CONTACT" subjectId={id} attached={tags.map((link) => ({ tagId: link.tagId, name: link.tag.name, color: link.tag.color }))} canEdit={canEdit} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <Field label="Lead Source" value={contact.leadSource} />
                <Field label="Campaign" value={campaigns.map((entry) => entry.campaign.name).join(", ") || null} />
                <Field label="External ID" value={contact.externalId} />
                <Field label="Team" value={contact.team?.name} />
                <Field label="Created" value={contact.createdAt.toLocaleDateString()} />
                <CustomFieldsPanel defs={cfDefs} values={contact.customFields} />
              </dl>
            </div>
          </section>

          {relatedOpportunities.length > 0 ? (
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Opportunities</h2>
                <span className="badge badge-neutral">{relatedOpportunities.length}</span>
              </div>
              <div className="card-body">
                <ul className="space-y-2">
                  {relatedOpportunities.map((opportunity) => (
                    <li key={opportunity.id} className="flex items-center justify-between text-[13px]">
                      <Link href={`/opportunities/${opportunity.id}`} className="font-medium text-[var(--brand-700)] hover:underline">
                        {opportunity.name}
                      </Link>
                      <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                        {opportunity.stage.name} · {opportunity.status.toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          <section className="card">
            <div className="card-header"><h2 className="card-title">Activities</h2></div>
            <div className="card-body">
              <RecordActivities
                subjectType="CONTACT"
                subjectId={id}
                subjectLabel={`${contact.firstName} ${contact.lastName}`}
                canEdit={canEdit}
                notes={notes.map((note) => ({ id: note.id, body: note.body, createdAt: note.createdAt.toISOString(), author: note.author }))}
                appointments={appointments.map((appointment) => ({ id: appointment.id, title: appointment.title, startAt: appointment.startAt.toISOString(), endAt: appointment.endAt?.toISOString() ?? null, status: appointment.status, locationOrLink: appointment.locationOrLink }))}
              />
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card-title">Files</h2></div>
            <div className="card-body">
              <AttachmentsPanel subjectType="CONTACT" subjectId={id} canUpload={canUpload} canDelete={canDeleteFiles} />
            </div>
          </section>
        </div>

        <aside className="no-print">
          <div className="card sticky top-[68px]">
            <div className="card-header">
              <h2 className="card-title">Timeline</h2>
              <span className="badge badge-neutral">{events.length}</span>
            </div>
            <div className="card-body max-h-[600px] overflow-y-auto">
              <Timeline events={events} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
