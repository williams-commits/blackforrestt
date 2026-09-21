import { DashboardCards } from "@/components/DashboardCards";
import { HomeWidgets } from "@/components/HomeWidgets";
import { SmartTips } from "@/components/SmartTips";
import { RecentRecords } from "@/components/RecentRecords";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Quiet, unboxed hero — hierarchy comes from typography and whitespace,
          not a filled banner. CTAs keep their hrefs and carry the Button
          visual system (btn-primary / btn-secondary). */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="workspace-eyebrow">Workspace overview</p>
          <h1 className="text-2xl font-semibold tracking-tight text-(--text-primary) sm:text-3xl">
            Good to see you.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-(--text-secondary)">
            Your pipeline, priorities, and team activity in one focused view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/tasks?mine=1" className="btn btn-primary">
            Open my tasks
          </Link>
          <Link href="/leads" className="btn btn-secondary">
            View pipeline
          </Link>
        </div>
      </header>
      <DashboardCards />
      <SmartTips context="dashboard" />
      <RecentRecords />
      <HomeWidgets />
    </div>
  );
}
