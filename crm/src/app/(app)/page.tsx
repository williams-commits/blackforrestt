import { DashboardCards } from "@/components/DashboardCards";
import { HomeWidgets } from "@/components/HomeWidgets";
import { SmartTips } from "@/components/SmartTips";
import { RecentRecords } from "@/components/RecentRecords";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="relative overflow-hidden rounded-xl border border-(--brand-800) px-6 py-6 text-white shadow-lg sm:px-8 sm:py-7" style={{ background: "linear-gradient(120deg, var(--brand-900), var(--brand-700))" }}>
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-green-200">Workspace overview</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Good to see you.</h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-green-50/80">
              Your pipeline, priorities, and team activity in one focused view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/tasks?mine=1"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-white px-3.5 text-sm font-semibold text-(--brand-900) shadow-sm transition hover:bg-green-50"
            >
              Open my tasks
            </Link>
            <Link
              href="/leads"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-white/30 px-3.5 text-sm font-semibold text-white transition hover:bg-white/10 hover:border-white/50"
            >
              View pipeline
            </Link>
          </div>
        </div>
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border border-white/10" />
        <div className="absolute -bottom-24 right-20 h-44 w-44 rounded-full border border-white/10" />
      </section>
      <DashboardCards />
      <SmartTips context="dashboard" />
      <RecentRecords />
      <HomeWidgets />
    </div>
  );
}
