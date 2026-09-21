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
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";
import { CommentsSection } from "@/components/CommentsSection";
import { TaskDetailActions } from "@/components/TaskDetailActions";
import { TaskViewersPanel } from "@/components/TaskViewersPanel";

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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>{label}</dt>
      <dd className="text-[13px] font-medium" style={{ color: value ? "var(--text-primary)" : "var(--text-tertiary)" }}>{value || "—"}</dd>
    </div>
  );
}

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

      <HighlightsPanel
        title={task.title}
        badge={{ label: task.status.replaceAll("_", " ").toLowerCase(), variant: STATUS_VARIANT[task.status] ?? "brand" }}
        fields={[
          { label: "Owner", value: task.owner.name },
          { label: "Due", value: overdue ? `⚠ ${dueText}` : dueText || "—" },
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
        <TaskDetailActions taskId={task.id} status={task.status} canEdit={canEdit} />
      </HighlightsPanel>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <RecordPageTabs
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "comments", label: `Comments (${comments.length})` },
          ]}
        >
          <div className="card">
            <div className="card-header"><h2 className="card-title">Task details</h2></div>
            <div className="card-body">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Status" value={task.status.replaceAll("_", " ").toLowerCase()} />
                <Field label="Completed" value={formatDateTime(task.completedAt) || "—"} />
                <Field label="Created" value={formatDateTime(task.createdAt)} />
                <Field label="Updated" value={formatDateTime(task.updatedAt)} />
                <Field label="Owner email" value={task.owner.email} />
                <Field label="Task ID" value={task.id} />
              </dl>
              <div className="mt-4">
                <dt className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Viewers (view-only access)</dt>
                <div className="mt-1.5">
                  <TaskViewersPanel
                    taskId={task.id}
                    initialUsers={task.viewerUsers.map((entry) => entry.user)}
                    initialTeams={task.viewerTeams.map((entry) => entry.team)}
                    canManage={managesViewers}
                  />
                </div>
              </div>
              {task.description ? (
                <div className="mt-4">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Description</dt>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed font-medium" style={{ color: task.description ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                    {task.description}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <div className="card">
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
          </div>
        </RecordPageTabs>

        <aside className="space-y-4">
          <div className="card sticky top-17">
            <div className="card-header"><h2 className="card-title">Activity</h2></div>
            <div className="card-body max-h-150 overflow-y-auto">
              <Timeline events={events} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
