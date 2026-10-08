/**
 * Thin fetch helper for TanStack Query queryFns. Unwraps nothing — returns
 * the API's parsed `{ data, meta }` envelope — but converts non-2xx
 * responses into thrown Errors carrying the API's own `error` message, so
 * `query.error` is always a readable string. Session-expiry redirects and
 * network failures surface the same way; retry policy stays with the QueryClient.
 */
export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }
  return body as T;
}
