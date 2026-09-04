import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { getCustomer } from "@/server/records/customers";
import { scopedContext } from "@/server/records/leads";
import { listTimeline } from "@/server/activity";
import { listNotesBySubject } from "@/server/records/notes";
import { listAppointmentsBySubject } from "@/server/records/appointments";
import { Timeline } from "@/components/Timeline";
import { ActivityComposer } from "@/components/ActivityComposer";
import { HighlightsPanel } from "@/components/HighlightsPanel";
import { RecordPageTabs } from "@/components/RecordPageTabs";
import { TagEditor } from "@/components/TagEditor";
import { CustomFieldsPanel } from "@/components/CustomFieldsPanel";
import { listTagsForSubject } from "@/server/records/tags";
import { listCustomFields } from "@/server/records/customFields";
import { client360 } from "@/server/platformBridge";
import { RecordActivities } from "@/components/RecordActivities";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { RecordDetailActions } from "@/components/RecordDetailActions";
import { SendEmailButton } from "@/components/SendEmailButton";
import { PlatformLinkPanel, PlatformUnlinkButton } from "@/components/PlatformLinkPanel";

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

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  let customer;
  let events: Awaited<ReturnType<typeof listTimeline>> = [];
  let tags: Awaited<ReturnType<typeof listTagsForSubject>> = [];
  let cfDefs: Awaited<ReturnType<typeof listCustomFields>> = [];
  let notes: Awaited<ReturnType<typeof listNotesBySubject>> = [];
  let appointments: Awaited<ReturnType<typeof listAppointmentsBySubject>> = [];
  let platform: Awaited<ReturnType<typeof client360>> = null;
  let campaigns: Array<{ campaign: { name: string } }> = [];
  let canEdit = false;
  let canUpload = false;
  let canDeleteFiles = false;
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
    campaigns = await prisma.campaignMember.findMany({ where: { subjectType: "CUSTOMER", subjectId: id }, include: { campaign: true } });
    canEdit = ctx.permissions.includes("CUSTOMERS_EDIT");
    canUpload = ctx.permissions.includes("FILES_UPLOAD");
    canDeleteFiles = ctx.permissions.includes("FILES_DELETE");
    canDelete = ctx.permissions.includes("CUSTOMERS_DELETE");
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/customers");
    throw error;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <nav className="breadcrumb no-print" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="breadcrumb-sep">/</span>
        <Link href="/customers">Customers</Link><span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{customer.firstName} {customer.lastName}</span>
      </nav>

      <HighlightsPanel
        title={`${customer.firstName} ${customer.lastName}`}
        badge={customer.status ? { label: customer.status.name, variant: "brand" as never } : undefined}
        fields={[
          { label: "Owner", value: customer.owner?.name },
          { label: "Email", value: customer.email },
          { label: "Phone", value: customer.phone },
          { label: "Source", value: customer.source },
          { label: "Platform", value: customer.platformUserId ? "Linked" : "Not linked" },
        ]}
      >
        <SendEmailButton subjectType="CUSTOMER" subjectId={id} email={customer.email} name={`${customer.firstName} ${customer.lastName}`} />
        <RecordDetailActions object="customers" row={customer as unknown as Record<string, unknown>} canEdit={canEdit} canDelete={canDelete} />
      </HighlightsPanel>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <RecordPageTabs
                        tabs={[
              { key: "overview", label: "Overview" },
              { key: "platform", label: "Platform" },
              { key: "activity", label: "Activity", count: notes.length + appointments.length },
              { key: "files", label: "Files" },
            ]}
          >
          {/* Details */}
          <section className="card">
            <div className="card-header"><h2 className="card-title">Details</h2></div>
            <div className="card-body space-y-4">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Tags</p>
                <TagEditor
                  subjectType="CUSTOMER"
                  subjectId={id}
                  attached={tags.map((link) => ({ tagId: link.tagId, name: link.tag.name, color: link.tag.color }))}
                  canEdit={canEdit}
                />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <Field label="Email" value={customer.email} />
                <Field label="Phone" value={customer.phone} />
                <Field label="Source" value={customer.source} />
                <Field
                  label="Linked Contact"
                  value={
                    customer.contact ? (
                      <Link href={`/contacts/${customer.contact.id}`} className="font-medium hover:underline" style={{ color: "var(--brand-700)" }}>
                        {customer.contact.firstName} {customer.contact.lastName}
                      </Link>
                    ) : null
                  }
                />
                <Field label="Team" value={customer.team?.name} />
                <Field label="Campaigns" value={campaigns.map((entry) => entry.campaign.name).join(", ") || null} />
                <Field label="Created" value={customer.createdAt.toLocaleDateString()} />
                <CustomFieldsPanel defs={cfDefs} values={customer.customFields} />
              </dl>
            </div>
          </section>

          {/* Platform bridge */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Platform (read-only bridge)</h2>
              {customer.platformUserId && canEdit ? (
                <PlatformUnlinkButton customerId={customer.id} />
              ) : null}
            </div>
            <div className="card-body">
              {customer.platformUserId ? (
                platform ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Account</p>
                      <p className="mt-1 text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{platform.user.name ?? platform.user.email ?? "—"}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{platform.user.email}</p>
                      <p className="mt-1 text-[11px]">
                        <span style={{ color: platform.user.state === "ACTIVE" ? "var(--success)" : "var(--error)" }}>
                          {platform.user.state.toLowerCase()}
                        </span>
                        <span style={{ color: "var(--text-tertiary)" }}> · registered {new Date(platform.user.registeredAt).toLocaleDateString()}</span>
                      </p>
                    </div>
                    <div className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>KYC</p>
                      <p className="mt-1 text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                        {platform.kyc?.status.replaceAll("_", " ").toLowerCase() ?? "not submitted"}
                      </p>
                      {platform.kyc?.submittedAt ? (
                        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                          submitted {new Date(platform.kyc.submittedAt).toLocaleDateString()}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>{platform.openPositions} open position(s)</p>
                    </div>
                    <div className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Wallets</p>
                      {platform.wallets.length === 0 ? (
                        <p className="mt-1 text-[13px]" style={{ color: "var(--text-tertiary)" }}>No wallets.</p>
                      ) : (
                        <ul className="mt-1 space-y-0.5 text-[13px]">
                          {platform.wallets.map((wallet) => (
                            <li key={wallet.asset} className="flex justify-between">
                              <span>{wallet.asset}</span>
                              <span style={{ color: "var(--text-secondary)" }}>
                                {Number(wallet.free).toLocaleString()} free
                                {Number(wallet.locked) > 0 ? ` · ${Number(wallet.locked).toLocaleString()} locked` : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {platform.payments.length > 0 ? (
                      <div className="sm:col-span-3">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Recent payments</p>
                        <table className="table">
                          <tbody>
                            {platform.payments.map((payment) => (
                              <tr key={payment.id}>
                                <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                                <td>{payment.type.toLowerCase()}</td>
                                <td>{Number(payment.amount).toLocaleString()} {payment.asset}</td>
                                <td style={{ color: "var(--text-secondary)" }}>{payment.status.toLowerCase()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[13px]" style={{ color: "var(--warning)" }}>
                    Linked, but the platform bridge is unavailable right now — refresh later.
                  </p>
                )
              ) : (
                <PlatformLinkPanel customerId={customer.id} customerEmail={customer.email} canEdit={canEdit} />
              )}
            </div>
          </section>

          {/* Activities */}
          <section className="card">
            <div className="card-header"><h2 className="card-title">Activities</h2></div>
            <div className="card-body">
              <RecordActivities
                subjectType="CUSTOMER"
                subjectId={id}
                subjectLabel={`${customer.firstName} ${customer.lastName}`}
                canEdit={canEdit}
                notes={notes.map((note) => ({ id: note.id, body: note.body, createdAt: note.createdAt.toISOString(), author: note.author }))}
                appointments={appointments.map((appointment) => ({ id: appointment.id, title: appointment.title, startAt: appointment.startAt.toISOString(), endAt: appointment.endAt?.toISOString() ?? null, status: appointment.status, locationOrLink: appointment.locationOrLink }))}
              />
            </div>
          </section>

          {/* Files */}
          <section className="card">
            <div className="card-header"><h2 className="card-title">Files</h2></div>
            <div className="card-body">
              <AttachmentsPanel subjectType="CUSTOMER" subjectId={id} canUpload={canUpload} canDelete={canDeleteFiles} />
            </div>
          </section>
          </RecordPageTabs>
        </div>

        {/* Timeline sidebar */}
        <aside className="no-print">
          <div className="card sticky top-17">
            <div className="card-header">
              <h2 className="card-title">Timeline</h2>
              <span className="badge badge-neutral">{events.length}</span>
            </div>
            <div style={{ marginBottom: "var(--space-3)" }}>
              <ActivityComposer subjectType="CUSTOMER" subjectId={id} subjectLabel={`${customer.firstName} ${customer.lastName}`} canEdit={canEdit} />
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
