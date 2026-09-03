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
 * Build a Prisma orderBy from a whitelisted sort key. `allowed` maps the
 * public sort name to an orderBy object; the fallback key must exist.
 */
export function orderByFor(
  requested: string | undefined,
  allowed: Record<string, Record<string, "asc" | "desc">>,
  fallbackKey: string,
): Record<string, "asc" | "desc"> {
  return (requested && allowed[requested]) || allowed[fallbackKey]!;
}
