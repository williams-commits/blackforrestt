import Link from "next/link";
import { scopedContext } from "@/server/records/leads";
import { pgSearch } from "@/server/search/pg";

export const dynamic = "force-dynamic";

export const metadata = { title: "Search" };

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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">Search</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {query.length < 2
            ? "Type at least two characters in the header search."
            : `${hits.length} result(s) for “${query}” (within your scope)`}
        </p>
      </div>
      {hits.length === 0 && query.length >= 2 ? (
        <p className="card empty-state">
          Nothing matched.
        </p>
      ) : (
        [...grouped.entries()].map(([type, list]) => (
          <section key={type} className="card">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              {type.toLowerCase()}s ({list.length})
            </h2>
            <ul className="divide-y divide-[var(--border-default)]">
              {list.map((hit) => (
                <li key={hit.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={hit.url} className="font-medium text-[--brand] hover:underline">
                    {hit.label}
                  </Link>
                  <span className="text-xs text-[var(--text-tertiary)]">{hit.subtitle}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
