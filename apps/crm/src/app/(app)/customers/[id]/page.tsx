import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { getCustomer } from "@/server/records/customers";
import { scopedContext } from "@/server/records/leads";
import { listTimeline } from "@/server/activity";
import { listNotesBySubjectPage } from "@/server/records/notes";
import { listAppointmentsBySubjectPage } from "@/server/records/appointments";
import { countSubjectTasks } from "@/server/records/tasks";
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
import { PlatformUnlinkButton } from "@/components/PlatformLinkPanel";
import { TradingAccountCard, TradingAccountDetails } from "@/components/TradingAccountPanel";
import { RecordWorkspaceTabs } from "@/components/RecordWorkspaceTabs";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";
import { getRecordCapabilities } from "@/lib/recordCapabilities";

import { DetailField } from "@/components/DetailOverview";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  let customer;
  let events: Awaited<ReturnType<typeof listTimeline>> = [];
  let tags: Awaited<ReturnType<typeof listTagsForSubject>> = [];
  let cfDefs: Awaited<ReturnType<typeof listCustomFields>> = [];
  let notes: Awaited<ReturnType<typeof listNotesBySubjectPage>> = { rows: [], total: 0 };
  let taskCount = 0;
  let appointments: Awaited<ReturnType<typeof listAppointmentsBySubjectPage>> = { rows: [], total: 0 };
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
    const ctx = await scopedContext("CUSTOMERS_VIEW");
    customer = await getCustomer(ctx, id);
    events = await listTimeline("CUSTOMER", id);
    tags = await listTagsForSubject(ctx, "CUSTOMER", id);
    cfDefs = (await listCustomFields(true)).filter((def) => def.objectType === "CUSTOMER");
    notes = await listNotesBySubjectPage("CUSTOMER", id, 1, ACTIVITY_STRIP_PAGE_SIZE);
    appointments = await listAppointmentsBySubjectPage("CUSTOMER", id, 1, ACTIVITY_STRIP_PAGE_SIZE);
    taskCount = await countSubjectTasks(ctx, "CUSTOMER", id);
    campaigns = await prisma.campaignMember.findMany({ where: { subjectType: "CUSTOMER", subjectId: id }, include: { campaign: true } });
    canViewEmails = ctx.permissions.includes("EMAILS_VIEW");
    const capabilities = getRecordCapabilities("CUSTOMER", ctx.permissions);
    canEdit = capabilities.canEdit;
    canAddNote = capabilities.canAddNote;
    canCreateTask = capabilities.canCreateTask;
    canScheduleAppointment = capabilities.canScheduleAppointment;
    canAssign = capabilities.canAssign;
    canChangeStatus = capabilities.canChangeStatus;
    canUpload = ctx.permissions.includes("FILES_UPLOAD");
    canDeleteFiles = ctx.permissions.includes("FILES_DELETE");
    canDelete = ctx.permissions.includes("CUSTOMERS_DELETE");
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/customers");
    throw error;
  }

  // Cross-module link back to the trading platform (env-gated: hidden
  // entirely when PLATFORM_TRADE_URL is not configured, like the bridge).
  const tradeBase = process.env.PLATFORM_TRADE_URL?.replace(/\/$/, "");
  const tradeUrl = tradeBase && customer?.platformUserId ? `${tradeBase}/admin` : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4" data-module="customers">
      <nav className="breadcrumb no-print" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="breadcrumb-sep">/</span>
        <Link href="/customers">Customers</Link><span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{customer.firstName} {customer.lastName}</span>
      </nav>
      <WorkspaceQuickNav backHref="/customers" backLabel="Customers list" />

      <RecordWorkspaceTabs
        type="customers"
        typeLabel="Customers"
        id={id}
        label={`${customer.firstName} ${customer.lastName}`}
        subtitle={[customer.source, customer.email].filter(Boolean).join(" · ")}
        href={`/customers/${id}`}
      />

      <HighlightsPanel
        title={`${customer.firstName} ${customer.lastName}`}
        badge={customer.status ? { label: customer.status.name, variant: "brand" as never, color: customer.status.color } : undefined}
        fields={[
          { label: "Owner", value: customer.owner?.name },
          { label: "Email", value: customer.email },
          { label: "Phone", value: customer.phone },
          { label: "Source", value: customer.source },
          { label: "Platform", value: customer.platformUserId ? "Linked" : "Not linked" },
        ]}
      >
        <RecordDetailActions object="customers" row={customer as unknown as Record<string, unknown>} canEdit={canEdit} canDelete={canDelete} canAssign={canAssign} canChangeStatus={canChangeStatus} 
          email={{ subjectType: "CUSTOMER", subjectId: id, to: customer.email, name: `${customer.firstName} ${customer.lastName}` }}
        />
      </HighlightsPanel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <RecordPageTabs
            tabs={[
              { key: "overview", label: "Overview" },
              { key: "platform", label: "Platform" },
              { key: "activity", label: "Activity", count: notes.total + appointments.total + taskCount },
              { key: "files", label: "Files" },
              ...(canViewEmails ? [{ key: "emails", label: "Emails" }] : []),
            ]}
          >
          {/* Details */}
          <section className="card">
            <div className="card-header"><h2 className="card-title flex items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden><Icon name="list" size={13} /></span>Details</h2></div>
            <div className="card-body space-y-4">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Tags</p>
                <TagEditor
                  subjectType="CUSTOMER"
                  subjectId={id}
                  attached={tags.map((link) => ({ tagId: link.tagId, name: link.tag.name, color: link.tag.color }))}
                />
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <DetailField label="Email" value={customer.email} />
                <DetailField label="Phone" value={customer.phone} />
                <DetailField label="Source" value={customer.source} />
                <DetailField
                  label="Linked Contact"
                  value={
                    customer.contact ? (
                      <Link href={`/contacts/${customer.contact.id}`} className="font-medium hover:underline" style={{ color: "var(--text-brand)" }}>
                        {customer.contact.firstName} {customer.contact.lastName}
                      </Link>
                    ) : null
                  }
                />
                <DetailField label="Team" value={customer.team?.name} />
                <DetailField label="Campaigns" value={campaigns.map((entry) => entry.campaign.name).join(", ") || null} />
                <DetailField label="Created" value={customer.createdAt.toLocaleDateString()} />
                <CustomFieldsPanel defs={cfDefs} values={customer.customFields} />
              </dl>
            </div>
          </section>

          {/* Platform bridge */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title flex items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden><Icon name="plug" size={13} /></span>Platform</h2>
              {customer.platformUserId && canEdit ? (
                <PlatformUnlinkButton customerId={customer.id} />
              ) : null}
            </div>
            <div className="card-body">
              <TradingAccountDetails customerId={id} customerEmail={customer.email} canEdit={canEdit} />
            </div>
          </section>

          {/* Activities */}
          <section className="card">
            <div className="card-header"><h2 className="card-title flex items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden><Icon name="clock" size={13} /></span>Activities</h2></div>
            <div className="card-body">
              <RecordActivities
                subjectType="CUSTOMER"
                subjectId={id}
                subjectLabel={`${customer.firstName} ${customer.lastName}`}
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

          {/* Files */}
          <section className="card">
            <div className="card-header"><h2 className="card-title flex items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden><Icon name="folder" size={13} /></span>Files</h2></div>
            <div className="card-body">
              <AttachmentsPanel subjectType="CUSTOMER" subjectId={id} canUpload={canUpload} canDelete={canDeleteFiles} />
            </div>
          </section>
            {canViewEmails ? (
              <RecordEmailHistory subjectType="CUSTOMER" subjectId={id} />
            ) : null}
          </RecordPageTabs>
        </div>

        {/* Timeline sidebar */}
        <aside className="no-print space-y-4">
          <TradingAccountCard customerId={id} tradeUrl={tradeUrl} />
          <div className="card lg:sticky lg:top-17">
            <div className="card-header">
              <h2 className="card-title flex items-center gap-1.5"><Icon name="clock" size={14} className="text-muted-foreground" />Timeline</h2>
              <span className="badge badge-neutral tabular-nums">{events.length}</span>
            </div>
            <div className="mx-3 mt-3">
              <ActivityComposer subjectType="CUSTOMER" subjectId={id} subjectLabel={`${customer.firstName} ${customer.lastName}`} canAddNote={canAddNote} canCreateTask={canCreateTask} canScheduleAppointment={canScheduleAppointment} />
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
