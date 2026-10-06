/**
 * Domain content resolution — consumes the GENERATED content registry.
 *
 * This keeps the platform renderer generic: it never imports a specific
 * domain's content implementation.
 */
import type { BrandProfile } from "@/lib/branding";
import type { DomainContentLoaders } from "@/content/contracts";
import { DOMAIN_CONTENT } from "@/domains/.generated/content";

async function loadersFor(domainKey: string): Promise<DomainContentLoaders> {
  const loader = DOMAIN_CONTENT[domainKey] ?? DOMAIN_CONTENT[Object.keys(DOMAIN_CONTENT)[0]!]!;
  return loader();
}

export async function landingBundle(domainKey: string, brand: BrandProfile) {
  const loaders = await loadersFor(domainKey);
  return loaders.landing(brand);
}

export async function publicChrome(domainKey: string, brand: BrandProfile) {
  const loaders = await loadersFor(domainKey);
  return loaders.publicChrome(brand);
}
