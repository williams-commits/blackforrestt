import Link from "next/link";
import { scopedContext } from "@/server/records/leads";
import { pgSearch } from "@/server/search/pg";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";

export const dynamic = "force-dynamic";

export const metadata = { title: "Search" };

const TYPE_LABELS: Record<string, string> = {
  LEAD: "Leads",
  CONTACT: "Contacts",
  ACCOUNT: "Accounts",
  CUSTOMER: "Customers",
  OPPORTUNITY: "Opportunities",
  TASK: "Tasks",
  NOTE: "Notes",
};

type PageProps = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const ctx = await scopedContext("LEADS_READ");
  const hits = query.length >= 2 ? await pgSearch.search(ctx, query, 25) : [];

  const grouped = new Map<string, typeof hits>();
  for (const hit of hits) {
    const list = grouped.get(hit.objectType) ?? [];
    list.push(hit);
    grouped.set(hit.objectType, list);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <WorkspaceHeader
        eyebrow="Command center"
        title="Search"
        subtitle={query.length < 2
          ? "Type at least two characters in the header search."
          : `${hits.length} result(s) for “${query}” (within your scope)`}
        metrics={query.length >= 2 ? [{ label: "Matches", value: hits.length, tone: hits.length ? "success" : "warning" }] : undefined}
      />
      <WorkspaceQuickNav />
      {hits.length === 0 && query.length >= 2 ? (
        <p className="card empty-state">
          Nothing matched.
        </p>
      ) : (
        [...grouped.entries()].map(([type, list]) => (
          <section key={type} className="card overflow-hidden">
            <h2 className="border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3 text-xs font-semibold uppercase tracking-wide text-(--text-tertiary)">
              {TYPE_LABELS[type] ?? type.toLowerCase()} ({list.length})
            </h2>
            <ul className="divide-y divide-(--border-default) px-4">
              {list.map((hit) => (
                <li key={hit.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={hit.url} className="font-medium text-(--brand) hover:underline">
                    {hit.label}
                  </Link>
                  <span className="text-xs text-(--text-tertiary)"> {hit.subtitle}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
