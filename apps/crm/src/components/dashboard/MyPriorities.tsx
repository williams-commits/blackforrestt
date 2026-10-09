"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";
import { useDashboard } from "./useDashboard";

interface TaskRow {
  id: string;
  title: string;
  dueAt: string | null;
  priority: string;
  subjectType: string | null;
  subjectId: string | null;
}

/** Operational layer — "what needs my attention / what should I do next?".
 *  Attention counters ride the dashboard query; the task list rides the
 *  shared ["tasks","widget"] cache so completing a task anywhere refreshes
 *  this card too. */
export function MyPriorities({ className }: { className?: string }) {
  const dashboard = useDashboard();
  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.widget,
    queryFn: () =>
      apiGet<{ data: TaskRow[]; meta: { openCount: number; overdueCount: number } }>("/api/tasks?mine=1"),
  });

  const overdue = dashboard.data?.myOverdueTasks ?? tasksQuery.data?.meta.overdueCount ?? null;
  const dueToday = dashboard.data?.myTasksDueToday ?? null;
  const tasks = tasksQuery.data?.data.slice(0, 4) ?? [];

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">My priorities</CardTitle>
        <Link href="/tasks?mine=1" className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          Task board
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {dashboard.isPending || tasksQuery.isPending ? (
          <>
            <div className="flex gap-2">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </>
        ) : tasksQuery.isError ? (
          <EmptyState
            icon="alert"
            tone="error"
            title="Tasks didn't load"
            description="Your queue is one retry away."
            action={<Button variant="secondary" size="sm" icon="refresh" onClick={() => void tasksQuery.refetch()}>Retry</Button>}
          />
        ) : (
          <>
            {/* Attention chips — the dashboard's "needs attention" answer. */}
            <div className="flex flex-wrap gap-2">
              {overdue !== null && overdue > 0 ? (
                <Link
                  href="/tasks?due=overdue&mine=1"
                  className="inline-flex items-center gap-1.5 rounded-full bg-(--error-bg) px-2.5 py-1 text-xs font-medium text-(--error) transition-opacity hover:opacity-80"
                >
                  <Icon name="alert" size={12} /> {overdue} overdue
                </Link>
              ) : null}
              {dueToday !== null && dueToday > 0 ? (
                <Link
                  href="/tasks?due=upcoming&mine=1"
                  className="inline-flex items-center gap-1.5 rounded-full bg-(--warning-bg) px-2.5 py-1 text-xs font-medium text-(--warning) transition-opacity hover:opacity-80"
                >
                  <Icon name="clock" size={12} /> {dueToday} due today
                </Link>
              ) : null}
              {overdue === 0 && (dueToday === 0 || dueToday === null) ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-(--success-bg) px-2.5 py-1 text-xs font-medium text-(--success)">
                  <Icon name="check_circle" size={12} /> Nothing overdue
                </span>
              ) : null}
            </div>

            {tasks.length === 0 ? (
              <EmptyState
                icon="square_check"
                title="Nothing queued"
                description="No open tasks are assigned to you. Create one when the next follow-up lands."
                action={<Button variant="secondary" size="sm" icon="plus" href="/tasks?new=1">New task</Button>}
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {tasks.map((task) => {
                  const isOverdue = task.dueAt ? new Date(task.dueAt).getTime() < Date.now() : false;
                  return (
                    <li key={task.id}>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-muted"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Icon
                            name={task.priority === "URGENT" ? "alert" : task.priority === "HIGH" ? "clock" : "square_check"}
                            size={13}
                            className={cn("shrink-0", task.priority === "URGENT" ? "text-destructive" : "text-muted-foreground")}
                          />
                          <span className="min-w-0 truncate font-medium">{task.title}</span>
                        </span>
                        {task.dueAt ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                              isOverdue ? "bg-(--error-bg) text-(--error)" : "bg-muted text-muted-foreground",
                            )}
                          >
                            {new Date(task.dueAt).toLocaleDateString()}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
