import type { ScopedContext } from "@/server/records/leads";

/**
 * Global search abstraction. The default provider is Postgres trigram
 * (pg_trgm) ILIKE — fast enough at CRM scale and zero infrastructure. A
 * dedicated engine (Meilisearch, OpenSearch…) can replace it by
 * implementing SearchProvider; nothing else in the app touches search
 * internals.
 */

export type SearchObject = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY" | "TASK";

export interface SearchHit {
  objectType: SearchObject;
  id: string;
  label: string;
  subtitle: string | null;
  url: string;
}

export interface SearchProvider {
  /** Grouped, scope-filtered hits for a query. Providers MUST apply the
   *  actor's data scope — search is a read path like any other. */
  search(ctx: ScopedContext, query: string, perType: number): Promise<SearchHit[]>;
}
