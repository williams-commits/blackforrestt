import type { Prisma } from "@prisma/client";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { relativeTime, absoluteTime } from "@/lib/time";

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
  comment: { label: "Comment", icon: "comment", tone: "brand" },
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

/** Day bucket label for grouping: Today / Yesterday / weekday-qualified date. */
function dayLabel(date: Date): string {
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    ...(dayDiff > 6 ? { year: "numeric" } : { weekday: "long" }),
    month: "short",
    day: "numeric",
  });
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
 * Activity timeline — day-grouped vertical feed with per-kind icon
 * medallions on a hairline connector, relative timestamps (absolute on
 * hover), and payload summaries. Rows highlight on hover.
 */
export function Timeline({ events }: { events: EventRow[] }) {
  if (events.length === 0) {
    return (
      <EmptyState icon="clock" title="No activity yet" description="Actions on this record will appear here." />
    );
  }

  // Group into day buckets (events arrive newest-first).
  const groups: Array<{ label: string; events: EventRow[] }> = [];
  for (const event of events) {
    const label = dayLabel(event.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.events.push(event);
    else groups.push({ label, events: [event] });
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <div className="sticky top-0 z-20 -mx-1 mb-1 bg-background/95 px-1 py-1 backdrop-blur-sm">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</h4>
          </div>
          {/* Connector rail runs behind the medallions (medallion center = 18px in). */}
          <div className="relative flex flex-col gap-0.5 before:absolute before:top-3 before:bottom-3 before:left-4.5 before:w-0.5 before:-translate-x-1/2 before:rounded-full before:bg-border">
            {group.events.map((event) => {
              const meta = KIND_META[event.kind] ?? { label: event.kind, icon: "clock", tone: "neutral" as Tone };
              const summary = payloadSummary(event.payload);
              const iso = event.createdAt.toISOString();
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
                      <time
                        className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
                        dateTime={iso}
                        title={absoluteTime(iso)}
                      >
                        {relativeTime(iso)}
                      </time>
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
        </section>
      ))}
    </div>
  );
}
