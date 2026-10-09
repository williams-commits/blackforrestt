import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { Button } from "@/components/ui";
import { SmartTips } from "@/components/SmartTips";
import { RecentRecords } from "@/components/RecentRecords";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { PipelineHealth } from "@/components/dashboard/PipelineHealth";
import { MyPriorities } from "@/components/dashboard/MyPriorities";
import { TeamInbox } from "@/components/dashboard/TeamInbox";
import { RecentActivity } from "@/components/dashboard/RecentActivity";

export const dynamic = "force-dynamic";

function greetingFor(hour: number): string {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The operational home — answers, in order: what's happening (KPIs with real
 * deltas), what needs attention (overdue/due-today), what changed (team
 * activity), what's next (priorities), how the pipeline is doing (stage
 * health). Everything rides the single scoped dashboard query or the shared
 * tasks/notifications caches.
 */
export default async function HomePage() {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      })
    : null;
  const firstName = user?.name?.split(" ")[0];

  const now = new Date();
  const today = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const greeting = greetingFor(now.getHours());

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header — contextual greeting, date, primary create. Unboxed:
          hierarchy comes from typography and whitespace, not a banner. */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {today}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your pipeline, priorities, and team activity in one focused view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon="plus" href="/leads?new=1">
            New lead
          </Button>
          <Button variant="secondary" icon="trending" href="/leads">
            View pipeline
          </Button>
        </div>
      </header>

      {/* KPI layer — the four numbers, with real deltas. */}
      <section aria-label="Key metrics">
        <KpiRow />
      </section>

      <SmartTips context="dashboard" />

      {/* Operational layer — pipeline performance next to personal attention. */}
      <section aria-label="Operations" className="grid gap-6 lg:grid-cols-5">
        <PipelineHealth className="lg:col-span-3" />
        <MyPriorities className="lg:col-span-2" />
      </section>

      {/* Context layer — what changed and what's waiting. */}
      <section aria-label="Context" className="grid gap-6 lg:grid-cols-5">
        <TeamInbox className="lg:col-span-2" />
        <RecentActivity className="lg:col-span-3" />
      </section>

      <RecentRecords />
    </div>
  );
}
