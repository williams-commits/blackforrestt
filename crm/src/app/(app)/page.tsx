import { DashboardCards } from "@/components/DashboardCards";
import { HomeWidgets } from "@/components/HomeWidgets";

const ROADMAP: Array<{ title: string; phase: number; detail: string; done?: boolean }> = [
  { title: "Foundation — auth, RBAC, teams, audit", phase: 1, detail: "Shipped", done: true },
  { title: "Core records & activities", phase: 2, detail: "Shipped — leads, contacts, accounts, customers", done: true },
  { title: "Tasks, notes, appointments, notifications", phase: 3, detail: "Shipped", done: true },
  { title: "Dedup, conversion & merge", phase: 4, detail: "Shipped", done: true },
  { title: "Opportunities & pipelines", phase: 5, detail: "Shipped — kanban, stage automation", done: true },
  { title: "CSV import wizard", phase: 6, detail: "Shipped — async jobs, error reports", done: true },
  { title: "Campaigns & configuration", phase: 7, detail: "Shipped — tags, custom fields, admin console", done: true },
  { title: "Global search & saved views", phase: 8, detail: "Shipped — trigram-indexed, scope-safe", done: true },
  { title: "Dashboards & reporting", phase: 9, detail: "Shipped — report engine, exports, KPI cards", done: true },
  { title: "Platform bridge", phase: 10, detail: "Customer ↔ trading-platform user linking" },
  { title: "Hardening & QA", phase: 11, detail: "Security review, load checks, runbook" },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <DashboardCards />
      <HomeWidgets />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Rollout plan
        </h2>
        <ul className="space-y-2">
          {ROADMAP.map((item) => (
            <li
              key={item.phase}
              className={`flex items-start gap-3 rounded-lg border p-4 ${
                item.done ? "border-[var(--brand)]/30 bg-[var(--brand)]/5" : "border-stone-200 bg-white"
              }`}
            >
              <span
                className={`mt-0.5 rounded px-1.5 py-0.5 text-xs font-semibold ${
                  item.done ? "text-white" : "bg-stone-200 text-stone-600"
                }`}
                style={item.done ? { background: "var(--brand)" } : undefined}
              >
                Phase {item.phase}
              </span>
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-stone-500">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
