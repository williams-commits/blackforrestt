import Link from "next/link";
import { redirect } from "next/navigation";
import { CrmError } from "@/server/guard";
import { getAccount } from "@/server/records/accounts";
import { scopedContext } from "@/server/records/leads";
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

export default async function AccountDetailPage({ params }: PageProps) {
  const { id } = await params;
  let account;
  let events: Awaited<ReturnType<typeof listTimeline>> = [];
  let notes: Awaited<ReturnType<typeof listNotesBySubject>> = [];
  let appointments: Awaited<ReturnType<typeof listAppointmentsBySubject>> = [];
  let canEdit = false;
  let canDelete = false;
  try {
    const ctx = await scopedContext("ACCOUNTS_READ");
    account = await getAccount(ctx, id);
    events = await listTimeline("ACCOUNT", id);
    notes = await listNotesBySubject("ACCOUNT", id);
    appointments = await listAppointmentsBySubject("ACCOUNT", id);
    canEdit = ctx.permissions.includes("ACCOUNTS_EDIT");
    canDelete = ctx.permissions.includes("ACCOUNTS_DELETE");
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/accounts");
    throw error;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">Account</p>
          <h1 className="text-xl font-semibold">{account.name}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {account.industry} · owner {account.owner.name}
          </p>
        </div>
        <RecordDetailActions object="accounts" row={account as unknown as Record<string, unknown>} canDelete={canDelete} canEdit={canEdit} />
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Overview</h2>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Industry" value={account.industry} />
            <Field label="Company size" value={account.companySize} />
            <Field label="Revenue (minor units)" value={account.revenue} />
            <Field
              label="Website"
              value={
                account.website ? (
                  <a href={account.website} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">
                    {account.website}
                  </a>
                ) : null
              }
            />
            <Field label="City" value={account.city} />
            <Field label="Country" value={account.country} />
            <Field label="External ID" value={account.externalId} />
            <Field label="Created" value={account.createdAt.toLocaleDateString()} />
          </dl>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Contacts ({account.contacts.length})
          </h2>
          {account.contacts.length === 0 ? (
            <p className="text-sm text-stone-400">No contacts linked yet.</p>
          ) : (
            <ul className="space-y-2">
              {account.contacts.map((contact) => (
                <li key={contact.id} className="flex items-center justify-between text-sm">
                  <Link href={`/contacts/${contact.id}`} className="font-medium text-[var(--brand)] hover:underline">
                    {contact.firstName} {contact.lastName}
                  </Link>
                  <span className="text-stone-500">{contact.jobTitle ?? contact.email ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Activities</h2>
        <RecordActivities
          subjectType="ACCOUNT"
          subjectId={id}
          subjectLabel={account.name}
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
