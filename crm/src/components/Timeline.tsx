import type { Prisma } from "@prisma/client";

type EventRow = Prisma.ActivityEventGetPayload<{ include: { actor: { select: { name: true } } } }>;

const KIND_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  status_changed: "Status changed",
  assigned: "Assigned",
  deleted: "Deleted",
  restored: "Restored",
  bulk_assigned: "Bulk assigned",
  bulk_status_changed: "Bulk status change",
  bulk_deleted: "Bulk deleted",
  note_added: "Note",
  task_created: "Task created",
  task_completed: "Task completed",
  task_cancelled: "Task cancelled",
  appointment_scheduled: "Appointment scheduled",
  appointment_completed: "Appointment completed",
  appointment_cancelled: "Appointment cancelled",
  imported: "Imported",
};

/** Unified record timeline rendered from the append-only ActivityEvent table. */
export function Timeline({ events }: { events: EventRow[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-stone-400">No activity yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3 rounded-md border border-stone-200 bg-white p-3">
          <span
            aria-hidden
            className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: "var(--brand)" }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {KIND_LABELS[event.kind] ?? event.kind}
              {event.payload && typeof event.payload === "object" && "to" in (event.payload as object) ? (
                <span className="font-normal text-stone-500">
                  {" "}
                  → {String((event.payload as { to?: unknown }).to)}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-stone-400">
              {event.actor?.name ?? "System"} ·{" "}
              {event.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
