import { z } from "zod";

/**
 * Shared query-string contract for every list endpoint/page: server-side
 * pagination, sorting, and search. Filtering by object-specific fields is
 * composed by the caller on top of this.
 */
export const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().trim().min(1).max(40).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().trim().max(120).optional(),
});

export type ListQueryInput = z.infer<typeof ListQuery>;

/** Parse list-query params from a URLSearchParams (page ?a=b&…). */
export function parseListQuery(params: URLSearchParams): ListQueryInput {
  return ListQuery.parse({
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
    sort: params.get("sort") ?? undefined,
    order: params.get("order") ?? undefined,
    q: params.get("q") ?? undefined,
  });
}

/** Case-insensitive contains across the object's searchable fields. */
export function searchWhere(fields: readonly string[], q: string): Record<string, unknown> | undefined {
  if (!q || fields.length === 0) return undefined;
  return {
    OR: fields.map((field) => ({ [field]: { contains: q, mode: "insensitive" } })),
  };
}

/**
 * Case-insensitive contains across scalar fields AND to-one relation
 * columns, so a table search on "New" also matches a status named New and
 * a search on a person's name matches the assignee column. `relations`
 * maps a Prisma relation name to the related-model columns to match.
 */
export function deepSearchWhere(
  fields: readonly string[],
  relations: Record<string, readonly string[]>,
  q: string,
): Record<string, unknown> | undefined {
  if (!q) return undefined;
  const scalar = fields.map((field) => ({ [field]: { contains: q, mode: "insensitive" } }));
  const related = Object.entries(relations).map(([relation, columns]) => ({
    [relation]:
      columns.length === 1
        ? { [columns[0]!]: { contains: q, mode: "insensitive" } }
        : { OR: columns.map((column) => ({ [column]: { contains: q, mode: "insensitive" } })) },
  }));
  const or = [...scalar, ...related];
  return or.length > 0 ? { OR: or } : undefined;
}

/**
 * Build a Prisma orderBy from a whitelisted sort key. `allowed` maps the
 * public sort name to an orderBy object; the fallback key must exist.
 * `order` (the ?order= param) overrides the direction of the resolved
 * mapping — every current SORTS entry is single-key, so flipping all its
 * keys is exact. Legacy callers that pass no order keep the SORTS default.
 */
export function orderByFor(
  requested: string | undefined,
  allowed: Record<string, Record<string, "asc" | "desc">>,
  fallbackKey: string,
  order?: "asc" | "desc",
): Record<string, "asc" | "desc"> {
  const resolved = (requested && allowed[requested]) || allowed[fallbackKey]!;
  if (!order) return resolved;
  return Object.fromEntries(Object.entries(resolved).map(([key]) => [key, order]));
}

/** Extract `cf_<key>=<value>` params for JSONB custom-field filtering. */
export function customFieldFilters(params: URLSearchParams): Array<{ key: string; value: string }> {
  const filters: Array<{ key: string; value: string }> = [];
  for (const [name, value] of params.entries()) {
    if (name.startsWith("cf_") && value) {
      filters.push({ key: name.slice(3), value });
    }
  }
  return filters;
}

/** Prisma JSONB path-equals fragments, AND-combined. */
export function customFieldWhere(
  filters: Array<{ key: string; value: string }>,
): Record<string, unknown> | undefined {
  if (filters.length === 0) return undefined;
  return {
    AND: filters.map((filter) => ({
      customFields: { path: [filter.key], equals: filter.value },
    })),
  };
}
