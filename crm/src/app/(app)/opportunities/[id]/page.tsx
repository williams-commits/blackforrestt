import Link from "next/link";
import { redirect } from "next/navigation";
import { CrmError } from "@/server/guard";
import { getOpportunity } from "@/server/records/opportunities";
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
import { OpportunityDetailActions } from "@/components/OpportunityDetailActions";

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

export default async function OpportunityDetailPage({ params }: PageProps) {
  const { id } = await params;
  let opportunity;
  let events: Awaited<ReturnType<typeof listTimeline>> = [];
  let tags: Awaited<ReturnType<typeof listTagsForSubject>> = [];
  let cfDefs: Awaited<ReturnType<typeof listCustomFields>> = [];
  let notes: Awaited<ReturnType<typeof listNotesBySubject>> = [];
  let appointments: Awaited<ReturnType<typeof listAppointmentsBySubject>> = [];
  let canEdit = false;
  let canDelete = false;
  try {
    const ctx = await scopedContext("OPPORTUNITIES_READ");
    opportunity = await getOpportunity(ctx, id);
    events = await listTimeline("OPPORTUNITY", id);
    tags = await listTagsForSubject("OPPORTUNITY", id);
    cfDefs = (await listCustomFields(true)).filter((def) => def.objectType === "OPPORTUNITY");
    notes = await listNotesBySubject("OPPORTUNITY", id);
    appointments = await listAppointmentsBySubject("OPPORTUNITY", id);
    canEdit = ctx.permissions.includes("OPPORTUNITIES_EDIT");
    canDelete = ctx.permissions.includes("OPPORTUNITIES_DELETE");
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/opportunities");
    throw error;
  }

  const value = opportunity.value ? Number(opportunity.value) / 100 : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">
            Opportunity · {opportunity.pipeline.name}
          </p>
          <h1 className="text-xl font-semibold">{opportunity.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium">
              {opportunity.stage.name}
            </span>
            <span className={opportunity.status === "WON" ? "font-medium text-green-700" : opportunity.status === "LOST" ? "text-red-600" : ""}>
              {opportunity.status.toLowerCase()}
            </span>
            {value !== null ? <span>· {value.toLocaleString(undefined, { style: "currency", currency: opportunity.currency, maximumFractionDigits: 0 })} @ {opportunity.probability}%</span> : null}
            <span>· owner {opportunity.owner.name}</span>
          </p>
        </div>
        <OpportunityDetailActions row={opportunity as unknown as Record<string, unknown>} canEdit={canEdit} canDelete={canDelete} />
      </header>

      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Overview</h2>
        <div className="mb-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-stone-400">Tags</p>
          <TagEditor
            subjectType="OPPORTUNITY"
            subjectId={id}
            attached={tags.map((link) => ({ tagId: link.tagId, name: link.tag.name, color: link.tag.color }))}
            canEdit={canEdit}
          />
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field
            label="Account"
            value={
              opportunity.account ? (
                <Link href={`/accounts/${opportunity.account.id}`} className="text-[var(--brand)] hover:underline">
                  {opportunity.account.name}
                </Link>
              ) : null
            }
          />
          <Field
            label="Contact"
            value={
              opportunity.contact ? (
                <Link href={`/contacts/${opportunity.contact.id}`} className="text-[var(--brand)] hover:underline">
                  {opportunity.contact.firstName} {opportunity.contact.lastName}
                </Link>
              ) : null
            }
          />
          <Field label="Team" value={opportunity.team?.name} />
          <Field label="Source" value={opportunity.source} />
          <Field label="Expected close" value={opportunity.expectedCloseAt?.toLocaleDateString() ?? null} />
          <Field label="Closed" value={opportunity.closedAt?.toLocaleDateString() ?? null} />
          <Field label="Created" value={opportunity.createdAt.toLocaleDateString()} />
                  <CustomFieldsPanel defs={cfDefs} values={opportunity.customFields} />
        </dl>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Activities</h2>
        <RecordActivities
          subjectType="OPPORTUNITY"
          subjectId={id}
          subjectLabel={opportunity.name}
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
