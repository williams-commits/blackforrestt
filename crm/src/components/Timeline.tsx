import type { Prisma } from "@prisma/client";

type EventRow = Prisma.ActivityEventGetPayload<{ include: { actor: { select: { name: true } } } }>;

const KIND_META: Record<string, { label: string; dot: string }> = {
  created: { label: "Created", dot: "timeline-dot-brand" },
  updated: { label: "Updated", dot: "timeline-dot-neutral" },
  status_changed: { label: "Status changed", dot: "timeline-dot-info" },
  stage_changed: { label: "Stage changed", dot: "timeline-dot-info" },
  assigned: { label: "Assigned", dot: "timeline-dot-warning" },
  deleted: { label: "Deleted", dot: "timeline-dot-error" },
  restored: { label: "Restored", dot: "timeline-dot-success" },
  bulk_assigned: { label: "Bulk assigned", dot: "timeline-dot-warning" },
  bulk_status_changed: { label: "Bulk status change", dot: "timeline-dot-info" },
  bulk_deleted: { label: "Bulk deleted", dot: "timeline-dot-error" },
  note_added: { label: "Note added", dot: "timeline-dot-brand" },
  task_created: { label: "Task created", dot: "timeline-dot-success" },
  task_completed: { label: "Task completed", dot: "timeline-dot-success" },
  task_cancelled: { label: "Task cancelled", dot: "timeline-dot-error" },
  appointment_scheduled: { label: "Appointment scheduled", dot: "timeline-dot-info" },
  appointment_completed: { label: "Appointment completed", dot: "timeline-dot-success" },
  appointment_cancelled: { label: "Appointment cancelled", dot: "timeline-dot-error" },
  converted: { label: "Converted", dot: "timeline-dot-success" },
  merged: { label: "Merged into this record", dot: "timeline-dot-neutral" },
  email_sent: { label: "Email sent", dot: "timeline-dot-warning" },
  imported: { label: "Imported", dot: "timeline-dot-neutral" },
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
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Activity timeline — vertical feed with colored connector dots,
 * relative timestamps, and expandable payload summaries.
 */
export function Timeline({ events }: { events: EventRow[] }) {
  if (events.length === 0) {
    return (
      <div className="empty-state">
        <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        <p className="empty-state-title">No activity yet</p>
        <p className="empty-state-description">Actions on this record will appear here.</p>
      </div>
    );
  }

  return (
    <div className="timeline">
      {events.map((event) => {
        const meta = KIND_META[event.kind] ?? { label: event.kind, dot: "timeline-dot-neutral" };
        const summary = payloadSummary(event.payload);
        return (
          <div key={event.id} className="timeline-item">
            <span className={`timeline-dot ${meta.dot}`} aria-hidden />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {meta.label}
                </span>
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {relativeTime(event.createdAt)}
                </span>
              </div>
              <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {event.actor?.name ?? "System"}
                {summary ? <span style={{ color: "var(--text-tertiary)" }}> · {summary}</span> : null}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
