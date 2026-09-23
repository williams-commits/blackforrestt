import type { Prisma } from "@prisma/client";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";

type EventRow = Prisma.ActivityEventGetPayload<{ include: { actor: { select: { name: true } } } }>;

const KIND_META: Record<string, { label: string; icon: string; tone: Tone }> = {
  created: { label: "Created", icon: "plus", tone: "brand" },
  updated: { label: "Updated", icon: "edit", tone: "neutral" },
  status_changed: { label: "Status changed", icon: "refresh", tone: "info" },
  stage_changed: { label: "Stage changed", icon: "trending", tone: "info" },
  assigned: { label: "Assigned", icon: "users", tone: "warning" },
  deleted: { label: "Deleted", icon: "trash", tone: "error" },
  restored: { label: "Restored", icon: "refresh", tone: "success" },
  bulk_assigned: { label: "Bulk assigned", icon: "users", tone: "warning" },
  bulk_status_changed: { label: "Bulk status change", icon: "refresh", tone: "info" },
  bulk_deleted: { label: "Bulk deleted", icon: "trash", tone: "error" },
  note_added: { label: "Note added", icon: "note", tone: "brand" },
  task_created: { label: "Task created", icon: "square_check", tone: "success" },
  task_completed: { label: "Task completed", icon: "check_circle", tone: "success" },
  task_cancelled: { label: "Task cancelled", icon: "x_circle", tone: "error" },
  appointment_scheduled: { label: "Appointment scheduled", icon: "calendar", tone: "info" },
  appointment_completed: { label: "Appointment completed", icon: "check_circle", tone: "success" },
  appointment_cancelled: { label: "Appointment cancelled", icon: "x_circle", tone: "error" },
  converted: { label: "Converted", icon: "check_circle", tone: "success" },
  merged: { label: "Merged into this record", icon: "plug", tone: "neutral" },
  email_sent: { label: "Email sent", icon: "mail", tone: "warning" },
  imported: { label: "Imported", icon: "upload", tone: "neutral" },
  comment: { label: "Comment", icon: "note", tone: "brand" },
};

type Tone = "brand" | "neutral" | "success" | "warning" | "error" | "info";

const TONE_CLASSES: Record<Tone, string> = {
  brand: "bg-primary/10 text-primary",
  neutral: "bg-muted text-muted-foreground",
  success: "bg-(--success-bg) text-(--success)",
  warning: "bg-(--warning-bg) text-(--warning)",
  error: "bg-(--error-bg) text-(--error)",
  info: "bg-(--info-bg) text-(--info)",
};

/** Relative time ("2 hours ago", "3 days ago") */
function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function payloadSummary(payload: Prisma.JsonValue | null): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof record.to === "string") parts.push(`→ ${record.to}`);
  if (typeof record.subject === "string") parts.push(record.subject);
  if (typeof record.title === "string") parts.push(record.title);
  if (typeof record.label === "string") parts.push(record.label);
  if (typeof record.mergedLeadName === "string") parts.push(`from ${record.mergedLeadName}`);
  if (typeof record.excerpt === "string") parts.push(record.excerpt);
  if (typeof record.comment === "string") parts.push(record.comment);
  if (record.state === "edited" || record.state === "deleted") parts.push(`(${record.state})`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Activity timeline — vertical feed with per-kind icon medallions on a
 * hairline connector, relative timestamps (absolute time on hover), and
 * payload summaries. Rows highlight on hover.
 */
export function Timeline({ events }: { events: EventRow[] }) {
  if (events.length === 0) {
    return (
      <div className="empty-state">
        <Icon name="clock" size={48} strokeWidth={1.5} className="empty-state-icon" />
        <p className="empty-state-title">No activity yet</p>
        <p className="empty-state-description">Actions on this record will appear here.</p>
      </div>
    );
  }

  return (
    // Connector rail runs behind the medallions (medallion center = 18px in).
    <div className="relative flex flex-col gap-0.5 before:absolute before:top-3 before:bottom-3 before:left-4.5 before:w-0.5 before:-translate-x-1/2 before:rounded-full before:bg-border">
      {events.map((event) => {
        const meta = KIND_META[event.kind] ?? { label: event.kind, icon: "clock", tone: "neutral" as Tone };
        const summary = payloadSummary(event.payload);
        return (
          <div
            key={event.id}
            className="relative flex gap-2.5 rounded-md p-1.5 transition-colors hover:bg-muted/50"
          >
            <span
              className={cn(
                "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full",
                TONE_CLASSES[meta.tone]
              )}
              aria-hidden
            >
              <Icon name={meta.icon} size={12} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-foreground">
                  {meta.label}
                </span>
                <span
                  className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground"
                  title={event.createdAt.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
                >
                  {relativeTime(event.createdAt)}
                </span>
              </div>
              <p className="truncate text-[12px] text-muted-foreground">
                {event.actor?.name ?? "System"}
                {summary ? <span className="text-muted-foreground/70"> · {summary}</span> : null}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
