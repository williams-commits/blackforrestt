import { DashboardCards } from "@/components/DashboardCards";
import { HomeWidgets } from "@/components/HomeWidgets";
import { SmartTips } from "@/components/SmartTips";
import { RecentRecords } from "@/components/RecentRecords";
import { Button } from "@/components/ui";

export default function HomePage() {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      {/* Quiet, unboxed hero — hierarchy comes from typography and whitespace,
          not a filled banner. The date line grounds the dashboard in "today". */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {today}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Good to see you.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your pipeline, priorities, and team activity in one focused view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon="square_check" href="/tasks?mine=1">
            Open my tasks
          </Button>
          <Button variant="secondary" icon="trending" href="/leads">
            View pipeline
          </Button>
        </div>
      </header>

      <section aria-label="Key metrics" className="space-y-3">
        <DashboardCards />
      </section>

      <SmartTips context="dashboard" />

      <RecentRecords />

      <section aria-label="My work and inbox" className="space-y-3">
        <HomeWidgets />
      </section>
    </div>
  );
}
