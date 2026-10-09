"use client";

import Link from "next/link";
import { Initials } from "@/components/Initials";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, EmptyState } from "@/components/ui";
import { relativeTime, absoluteTime } from "@/lib/time";
import { useDashboard } from "./useDashboard";

const KIND_LABELS: Record<string, string> = {
  created: "created",
  updated: "updated",
  status_changed: "changed status on",
  stage_changed: "moved stage on",
  assigned: "assigned",
  deleted: "deleted",
  restored: "restored",
  bulk_assigned: "bulk-assigned",
  bulk_status_changed: "bulk-updated",
  bulk_deleted: "bulk-deleted",
  note_added: "added a note on",
  note_updated: "edited a note on",
  task_created: "created a task on",
  task_completed: "completed a task on",
  task_cancelled: "cancelled a task on",
  appointment_scheduled: "scheduled an appointment on",
  appointment_updated: "updated an appointment on",
  appointment_completed: "completed an appointment on",
  appointment_cancelled: "cancelled an appointment on",
  converted: "converted",
  merged: "merged",
  email_sent: "emailed",
  imported: "imported",
  comment: "commented on",
};

const SUBJECT_COLLECTIONS: Record<string, string> = {
  LEAD: "leads",
  CONTACT: "contacts",
  ACCOUNT: "accounts",
  CUSTOMER: "customers",
  OPPORTUNITY: "opportunities",
  CAMPAIGN: "campaigns",
  TASK: "tasks",
};

const SUBJECT_LABELS: Record<string, string> = {
  LEAD: "a lead",
  CONTACT: "a contact",
  ACCOUNT: "an account",
  CUSTOMER: "a customer",
  OPPORTUNITY: "an opportunity",
  CAMPAIGN: "a campaign",
  TASK: "a task",
  NOTE: "a note",
  APPOINTMENT: "an appointment",
};

/** Context layer — "what changed?". The team-wide activity feed rides the
 *  dashboard request; the API only includes it for actors with audit access,
 *  and this card says so plainly instead of inventing a feed. */
export function RecentActivity({ className }: { className?: string }) {
  const { data, isError, isPending, refetch } = useDashboard();

  const activity = data?.recentActivity;

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Team activity</CardTitle>
        <Link href="/admin/audit" className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          Full log
        </Link>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Skeleton className="size-6 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon="alert"
            tone="error"
            title="Activity didn't load"
            description="The activity service didn't respond."
            action={<Button variant="secondary" size="sm" icon="refresh" onClick={() => void refetch()}>Retry</Button>}
          />
        ) : activity === undefined ? (
          <EmptyState
            icon="shield"
            title="Requires audit access"
            description="The team activity feed mirrors the audit log. Ask an admin for AUDIT_VIEW to follow every change here."
            action={<Button variant="secondary" size="sm" href="/notifications">My notifications</Button>}
          />
        ) : activity.length === 0 ? (
          <EmptyState
            icon="trending"
            title="No recent activity"
            description="Record changes across the team appear here as they happen."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {activity.map((entry) => {
              const collection = SUBJECT_COLLECTIONS[entry.subjectType];
              const href = collection ? `/${collection}/${entry.subjectId}` : null;
              const actor = entry.actorName ?? "Someone";
              const verb = KIND_LABELS[entry.kind] ?? entry.kind.replace(/_/g, " ");
              const object = SUBJECT_LABELS[entry.subjectType] ?? entry.subjectType.toLowerCase();
              return (
                <li key={entry.id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                  <span className="mt-0.5 shrink-0" aria-hidden>
                    <Initials name={actor} size="xs" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium text-foreground">{actor}</span>{" "}
                      <span className="text-muted-foreground">{verb}</span>{" "}
                      {href ? (
                        <Link href={href} className="font-medium text-foreground hover:underline">
                          {object}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">{object}</span>
                      )}
                    </p>
                    {entry.excerpt ? (
                      <p className="mt-0.5 truncate text-xs italic text-muted-foreground dark:text-foreground/70" title={entry.excerpt}>
                        “{entry.excerpt}”
                      </p>
                    ) : null}
                    <time
                      className="mt-0.5 block text-xs text-muted-foreground"
                      dateTime={entry.createdAt}
                      title={absoluteTime(entry.createdAt)}
                    >
                      {relativeTime(entry.createdAt)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
