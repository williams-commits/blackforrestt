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
import { client360 } from "@/server/platformBridge";
import { RecordActivities } from "@/components/RecordActivities";
import { RecordDetailActions } from "@/components/RecordDetailActions";
import { PlatformLinkPanel, PlatformUnlinkButton } from "@/components/PlatformLinkPanel";

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
  let platform: Awaited<ReturnType<typeof client360>> = null;
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
    platform = customer.platformUserId ? await client360(customer.platformUserId) : null;
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Platform (read-only bridge)
          </h2>
          {customer.platformUserId && canEdit ? (
            <PlatformUnlinkButton customerId={customer.id} />
          ) : null}
        </div>
        {customer.platformUserId ? (
          platform ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-md border border-stone-100 bg-stone-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Account</p>
                <p className="mt-1 text-sm font-medium">{platform.user.name ?? platform.user.email ?? "—"}</p>
                <p className="text-xs text-stone-500">{platform.user.email}</p>
                <p className="mt-1 text-xs">
                  State:{" "}
                  <span className={platform.user.state === "ACTIVE" ? "text-green-700" : "text-red-600"}>
                    {platform.user.state.toLowerCase()}
                  </span>{" "}
                  · registered {new Date(platform.user.registeredAt).toLocaleDateString()}
                </p>
              </div>
              <div className="rounded-md border border-stone-100 bg-stone-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">KYC</p>
                <p className="mt-1 text-sm font-medium">
                  {platform.kyc?.status.replaceAll("_", " ").toLowerCase() ?? "not submitted"}
                </p>
                {platform.kyc?.submittedAt ? (
                  <p className="text-xs text-stone-500">
                    submitted {new Date(platform.kyc.submittedAt).toLocaleDateString()}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-stone-500">{platform.openPositions} open position(s)</p>
              </div>
              <div className="rounded-md border border-stone-100 bg-stone-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Wallets</p>
                {platform.wallets.length === 0 ? (
                  <p className="mt-1 text-sm text-stone-400">No wallets.</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {platform.wallets.map((wallet) => (
                      <li key={wallet.asset} className="flex justify-between">
                        <span>{wallet.asset}</span>
                        <span>
                          {Number(wallet.free).toLocaleString()} free
                          {Number(wallet.locked) > 0 ? ` · ${Number(wallet.locked).toLocaleString()} locked` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="lg:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Recent payments</p>
                {platform.payments.length === 0 ? (
                  <p className="mt-1 text-sm text-stone-400">No payment requests.</p>
                ) : (
                  <table className="mt-1 w-full text-sm">
                    <tbody>
                      {platform.payments.map((payment) => (
                        <tr key={payment.id} className="border-b border-stone-100">
                          <td className="py-1">{new Date(payment.createdAt).toLocaleDateString()}</td>
                          <td className="py-1">{payment.type.toLowerCase()}</td>
                          <td className="py-1">{Number(payment.amount).toLocaleString()} {payment.asset}</td>
                          <td className="py-1 text-stone-500">{payment.status.toLowerCase()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-700">
              Linked, but the platform bridge is unavailable right now — refresh later.
            </p>
          )
        ) : (
          <PlatformLinkPanel customerId={customer.id} customerEmail={customer.email} canEdit={canEdit} />
        )}
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
