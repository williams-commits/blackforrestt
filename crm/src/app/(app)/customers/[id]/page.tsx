import Link from "next/link";
import { redirect } from "next/navigation";
import { CrmError } from "@/server/guard";
import { getCustomer } from "@/server/records/customers";
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

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  let customer;
  let events: Awaited<ReturnType<typeof listTimeline>> = [];
  let tags: Awaited<ReturnType<typeof listTagsForSubject>> = [];
  let cfDefs: Awaited<ReturnType<typeof listCustomFields>> = [];
  let notes: Awaited<ReturnType<typeof listNotesBySubject>> = [];
  let appointments: Awaited<ReturnType<typeof listAppointmentsBySubject>> = [];
  let canEdit = false;
  let canDelete = false;
  try {
    const ctx = await scopedContext("CUSTOMERS_READ");
    customer = await getCustomer(ctx, id);
    events = await listTimeline("CUSTOMER", id);
    tags = await listTagsForSubject("CUSTOMER", id);
    cfDefs = (await listCustomFields(true)).filter((def) => def.objectType === "CUSTOMER");
    notes = await listNotesBySubject("CUSTOMER", id);
    appointments = await listAppointmentsBySubject("CUSTOMER", id);
    canEdit = ctx.permissions.includes("CUSTOMERS_EDIT");
    canDelete = ctx.permissions.includes("CUSTOMERS_DELETE");
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/customers");
    throw error;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">Customer</p>
          <h1 className="text-xl font-semibold">
            {customer.firstName} {customer.lastName}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
            {customer.status ? (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium">
                {customer.status.name}
              </span>
            ) : null}
            <span>· owner {customer.owner.name}</span>
          </p>
        </div>
        <RecordDetailActions object="customers" row={customer as unknown as Record<string, unknown>} canEdit={canEdit} canDelete={canDelete} />
      </header>

      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Overview</h2>
        <div className="mb-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-stone-400">Tags</p>
          <TagEditor
            subjectType="CUSTOMER"
            subjectId={id}
            attached={tags.map((link) => ({ tagId: link.tagId, name: link.tag.name, color: link.tag.color }))}
            canEdit={canEdit}
          />
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Email" value={customer.email} />
          <Field label="Phone" value={customer.phone} />
          <Field label="Source" value={customer.source} />
          <Field
            label="Linked contact"
            value={
              customer.contact ? (
                <Link href={`/contacts/${customer.contact.id}`} className="text-[var(--brand)] hover:underline">
                  {customer.contact.firstName} {customer.contact.lastName}
                </Link>
              ) : null
            }
          />
          <Field label="Platform user" value={customer.platformUserId ? "linked" : "not linked"} />
          <Field label="Team" value={customer.team?.name} />
          <Field label="Created" value={customer.createdAt.toLocaleDateString()} />
                  <CustomFieldsPanel defs={cfDefs} values={customer.customFields} />
        </dl>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Activities</h2>
        <RecordActivities
          subjectType="CUSTOMER"
          subjectId={id}
          subjectLabel={`${customer.firstName} ${customer.lastName}`}
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
