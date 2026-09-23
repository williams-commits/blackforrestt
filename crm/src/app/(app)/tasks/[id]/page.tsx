import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CrmError } from "@/server/guard";
import { scopedContext } from "@/server/records/leads";
import { getTask } from "@/server/records/tasks";
import { listComments } from "@/server/records/comments";
import { listTimeline } from "@/server/activity";
import { Timeline } from "@/components/Timeline";
import { HighlightsPanel } from "@/components/HighlightsPanel";
import { RecordPageTabs } from "@/components/RecordPageTabs";
import { RecordWorkspaceTabs } from "@/components/RecordWorkspaceTabs";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";
import { CommentsSection } from "@/components/CommentsSection";
import { TaskDetailActions } from "@/components/TaskDetailActions";
import { TaskViewersPanel } from "@/components/TaskViewersPanel";

import { DetailField } from "@/components/DetailOverview";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Task · CRM" };

type PageProps = { params: Promise<{ id: string }> };

const SUBJECT_PATH: Record<string, string> = {
  LEAD: "leads",
  CONTACT: "contacts",
  ACCOUNT: "accounts",
  CUSTOMER: "customers",
  OPPORTUNITY: "opportunities",
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "error" | "info" | "neutral" | "brand"> = {
  OPEN: "brand",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

function formatDateTime(value: Date | string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default async function TaskDetailPage({ params }: PageProps) {
  const { id } = await params;
  let task: Awaited<ReturnType<typeof getTask>>;
  let events: Awaited<ReturnType<typeof listTimeline>> = [];
  let comments: Awaited<ReturnType<typeof listComments>> = [];
  let currentUserId = "";
  let canComment = false;
  let canManageComments = false;
  let canEdit = false;
  let managesViewers = false;
  try {
    const ctx = await scopedContext("TASKS_VIEW");
    currentUserId = ctx.userId;
    canComment = ctx.permissions.includes("COMMENTS_CREATE");
    canManageComments = ctx.permissions.includes("COMMENTS_MANAGE");
    canEdit = ctx.permissions.includes("TASKS_EDIT");
    task = await getTask(ctx, id);
    managesViewers = task.ownerUserId === ctx.userId || ctx.roleKey === "ADMIN" || ctx.roleKey === "SUPER_ADMIN";
    events = await listTimeline("TASK", id);
    comments = await listComments(ctx, "TASK", id);
  } catch (error) {
    if (error instanceof CrmError && error.status === 401) redirect("/login");
    if (error instanceof CrmError && error.status === 404) redirect("/tasks");
    throw error;
  }

  const dueText = formatDateTime(task.dueAt);
  const overdue = task.dueAt && task.dueAt < new Date() && (task.status === "OPEN" || task.status === "IN_PROGRESS");

  return (
    <div className="mx-auto max-w-6xl space-y-4" data-module="tasks">
      <nav className="breadcrumb no-print" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="breadcrumb-sep">/</span>
        <Link href="/tasks">Tasks</Link><span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{task.title}</span>
      </nav>
      <WorkspaceQuickNav backHref="/tasks" backLabel="Tasks list" />

      <RecordWorkspaceTabs
        type="tasks"
        typeLabel="Tasks"
        id={id}
        label={task.title}
        subtitle={[task.status.replaceAll("_", " ").toLowerCase(), task.priority.toLowerCase()].filter(Boolean).join(" · ")}
        href={`/tasks/${id}`}
      />

      <HighlightsPanel
        title={task.title}
        badge={{ label: task.status.replaceAll("_", " ").toLowerCase(), variant: STATUS_VARIANT[task.status] ?? "brand" }}
        fields={[
          { label: "Owner", value: task.owner.name },
          {
            label: "Due",
            value: overdue ? (
              <span style={{ color: "var(--error)" }}>Overdue — {dueText}</span>
            ) : dueText || "—",
          },
          { label: "Priority", value: task.priority.toLowerCase() },
          { label: "Recurrence", value: task.recurrence === "NONE" ? "—" : task.recurrence.toLowerCase() },
          { label: "Reminder", value: formatDateTime(task.reminderAt) || "—" },
          {
            label: "Linked to",
            value: task.subjectType && task.subjectId && SUBJECT_PATH[task.subjectType] ? (
              <Link href={`/${SUBJECT_PATH[task.subjectType]}/${task.subjectId}`} className="text-(--text-brand) hover:underline">
                {task.subjectType.toLowerCase()} …{task.subjectId.slice(-6)}
              </Link>
            ) : "—",
          },
        ]}
      >
        <TaskDetailActions taskId={task.id} status={task.status} canEdit={canEdit} task={task} />
      </HighlightsPanel>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <RecordPageTabs
            tabs={[
              { key: "overview", label: "Overview" },
              { key: "comments", label: "Comments", count: comments.length },
            ]}
          >
            <section className="card">
              <div className="card-header"><h2 className="card-title">Details</h2></div>
              <div className="card-body space-y-4">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <DetailField label="Status" value={task.status.replaceAll("_", " ").toLowerCase()} />
                  <DetailField label="Completed" value={formatDateTime(task.completedAt) || "—"} />
                  <DetailField label="Created" value={formatDateTime(task.createdAt)} />
                  <DetailField label="Updated" value={formatDateTime(task.updatedAt)} />
                  <DetailField label="Owner email" value={task.owner.email} />
                  <DetailField label="Task ID" value={task.id} />
                </dl>
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Viewers (view-only access)</p>
                  <TaskViewersPanel
                    taskId={task.id}
                    initialUsers={task.viewerUsers.map((entry) => entry.user)}
                    initialTeams={task.viewerTeams.map((entry) => entry.team)}
                    canManage={managesViewers}
                  />
                </div>
                {task.description ? (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Description</p>
                    <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed" style={{ color: "var(--text-primary)" }}>
                      {task.description}
                    </p>
                  </div>
                ) : null}
              </div>
            </section>
            <section className="card">
              <div className="card-header"><h2 className="card-title">Comments</h2></div>
              <div className="card-body">
                <CommentsSection
                  subjectType="TASK"
                  subjectId={task.id}
                  initial={comments}
                  canComment={canComment}
                  canManage={canManageComments}
                  currentUserId={currentUserId}
                />
              </div>
            </section>
          </RecordPageTabs>
        </div>

        <aside className="no-print">
          <div className="card lg:sticky lg:top-17">
            <div className="card-header">
              <h2 className="card-title flex items-center gap-1.5"><Icon name="clock" size={14} className="text-muted-foreground" />Timeline</h2>
              <span className="badge badge-neutral tabular-nums">{events.length}</span>
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
