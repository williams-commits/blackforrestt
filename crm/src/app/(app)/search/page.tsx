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
        <h1 className="text-lg font-semibold">Search</h1>
        <p className="text-sm text-stone-500">
          {query.length < 2
            ? "Type at least two characters in the header search."
            : `${hits.length} result(s) for “${query}” (within your scope)`}
        </p>
      </div>
      {hits.length === 0 && query.length >= 2 ? (
        <p className="rounded-lg border border-stone-200 bg-white p-8 text-center text-sm text-stone-400">
          Nothing matched.
        </p>
      ) : (
        [...grouped.entries()].map(([type, list]) => (
          <section key={type} className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
              {type.toLowerCase()}s ({list.length})
            </h2>
            <ul className="divide-y divide-stone-100">
              {list.map((hit) => (
                <li key={hit.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={hit.url} className="font-medium text-[var(--brand)] hover:underline">
                    {hit.label}
                  </Link>
                  <span className="text-xs text-stone-400">{hit.subtitle}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
