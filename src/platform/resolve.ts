/**
 * Request-level domain resolution — the server entry point every dispatcher
 * flows through. One call answers: which host, which brand family apex, which
 * registry domain, which landing/public design, and the fully-layered brand
 * profile.
 *
 *   resolveHost(request)  → domain identity → brand → content → design
 *
 * Server-only (next/headers). Pure host math without a request context lives
 * in registry.ts (usable by the middleware and next.config.ts).
 */
import { headers } from "next/headers";
import type { BrandProfile } from "@/lib/branding";
import { brandProfileForDomain } from "@/lib/branding";
import { resolveHostContext, type HostContext } from "@/platform/registry";

/** Everything the dispatchers (landing page, content layout, composition)
 *  need about the current request's domain. */
export interface ResolvedDomain {
  host: HostContext;
  /** Fully-layered brand profile (env override → registry → primary env). */
  brand: BrandProfile;
}

/** The domain context for the CURRENT request, from the Host header (honoring
 *  the reverse proxy's X-Forwarded-Host). Unknown/local hosts resolve to the
 *  default domain — same fallback every previous consumer used. */
export async function resolveCurrentDomain(): Promise<ResolvedDomain> {
  const headerList = await headers();
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "").split(",")[0]!.trim();
  const ctx = resolveHostContext(host);
  return { host: ctx, brand: brandProfileForDomain(ctx.apex) };
}
