import { redirect } from "next/navigation";
import { CrmError } from "@/server/guard";
import { getLead, scopedContext } from "@/server/records/leads";
import { listTimeline } from "@/server/activity";
import { listNotesBySubject } from "@/server/records/notes";
import { listAppointmentsBySubject } from "@/server/records/appointments";
import { Timeline } from "@/components/Timeline";
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

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  let lead;
  let events: Awaited<ReturnType<typeof listTimeline>> = [];
  let notes: Awaited<ReturnType<typeof listNotesBySubject>> = [];
  let appointments: Awaited<ReturnType<typeof listAppointmentsBySubject>> = [];
  let canEdit = false;
  let canDelete = false;
  try {
    const ctx = await scopedContext("LEADS_READ");
    lead = await getLead(ctx, id);
    events = await listTimeline("LEAD", id);
    notes = await listNotesBySubject("LEAD", id);
    appointments = await listAppointmentsBySubject("LEAD", id);
    canEdit = ctx.permissions.includes("LEADS_EDIT");
    canDelete = ctx.permissions.includes("LEADS_DELETE");
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/leads");
    throw error;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">Lead</p>
          <h1 className="text-xl font-semibold">
            {lead.firstName} {lead.lastName}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium">
              {lead.status.name}
            </span>
            <span>{lead.priority.toLowerCase()} priority</span>
            <span>score {lead.score}</span>
            <span>· assignee {lead.assignedUser?.name ?? "unassigned"}</span>
          </p>
        </div>
        <RecordDetailActions object="leads" row={lead as unknown as Record<string, unknown>} canEdit={canEdit} canDelete={canDelete} />
      </header>

      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Overview</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Email" value={lead.email} />
          <Field label="Phone" value={lead.phone} />
          <Field label="Secondary phone" value={lead.secondaryPhone} />
          <Field label="Company" value={lead.company} />
          <Field label="Country" value={lead.country} />
          <Field label="Region" value={lead.region} />
          <Field label="Source" value={lead.source} />
          <Field label="Campaign" value={lead.campaign?.name} />
          <Field label="External ID" value={lead.externalId} />
          <Field label="Last contact" value={lead.lastContactAt?.toLocaleDateString() ?? null} />
          <Field
            label="Next follow-up"
            value={lead.nextFollowUpAt?.toLocaleString() ?? null}
          />
          <Field label="Created" value={lead.createdAt.toLocaleDateString()} />
        </dl>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Activities</h2>
        <RecordActivities
          subjectType="LEAD"
          subjectId={id}
          subjectLabel={`${lead.firstName} ${lead.lastName}`}
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
