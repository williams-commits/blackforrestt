import Link from "next/link";
import { redirect } from "next/navigation";
import { CrmError } from "@/server/guard";
import { getContact } from "@/server/records/contacts";
import { scopedContext } from "@/server/records/leads";
import { listTimeline } from "@/server/activity";
import { listNotesBySubject } from "@/server/records/notes";
import { listAppointmentsBySubject } from "@/server/records/appointments";
import { Timeline } from "@/components/Timeline";
import { TagEditor } from "@/components/TagEditor";
import { CustomFieldsPanel } from "@/components/CustomFieldsPanel";
import { listTagsForSubject } from "@/server/records/tags";
import { listCustomFields } from "@/server/records/customFields";
import { RecordActivities } from "@/components/RecordActivities";
import { RecordDetailActions } from "@/components/RecordDetailActions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className="text-sm">{value || <span className="text-stone-300">—</span>}</dd>
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
  let canEdit = false;
  let canDelete = false;
  try {
    const ctx = await scopedContext("CONTACTS_READ");
    contact = await getContact(ctx, id);
    events = await listTimeline("CONTACT", id);
    tags = await listTagsForSubject("CONTACT", id);
    cfDefs = (await listCustomFields(true)).filter((def) => def.objectType === "CONTACT");
    notes = await listNotesBySubject("CONTACT", id);
    appointments = await listAppointmentsBySubject("CONTACT", id);
    canEdit = ctx.permissions.includes("CONTACTS_EDIT");
    canDelete = ctx.permissions.includes("CONTACTS_DELETE");
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/contacts");
    throw error;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">Contact</p>
          <h1 className="text-xl font-semibold">
            {contact.firstName} {contact.lastName}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
            {contact.status ? (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium">
                {contact.status.name}
              </span>
            ) : null}
            <span>{contact.jobTitle}</span>
            <span>· owner {contact.owner.name}</span>
          </p>
        </div>
        <RecordDetailActions object="contacts" row={contact as unknown as Record<string, unknown>} canEdit={canEdit} canDelete={canDelete} />
      </header>

      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Overview</h2>
        <div className="mb-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-stone-400">Tags</p>
          <TagEditor
            subjectType="CONTACT"
            subjectId={id}
            attached={tags.map((link) => ({ tagId: link.tagId, name: link.tag.name, color: link.tag.color }))}
            canEdit={canEdit}
          />
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Email" value={contact.email} />
          <Field label="Phone" value={contact.phone} />
          <Field label="Job title" value={contact.jobTitle} />
          <Field
            label="Account"
            value={
              contact.account ? (
                <Link href={`/accounts/${contact.account.id}`} className="text-[var(--brand)] hover:underline">
                  {contact.account.name}
                </Link>
              ) : null
            }
          />
          <Field label="Lead source" value={contact.leadSource} />
          <Field label="External ID" value={contact.externalId} />
          <Field label="Team" value={contact.team?.name} />
          <Field label="Created" value={contact.createdAt.toLocaleDateString()} />
                  <CustomFieldsPanel defs={cfDefs} values={contact.customFields} />
        </dl>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Activities</h2>
        <RecordActivities
          subjectType="CONTACT"
          subjectId={id}
          subjectLabel={`${contact.firstName} ${contact.lastName}`}
          canEdit={canEdit}
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
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Timeline</h2>
        <Timeline events={events} />
      </section>
    </div>
  );
}
