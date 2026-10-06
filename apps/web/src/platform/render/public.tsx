/**
 * Public-shell runtime composition — resolves domain → chrome content +
 * public design shell for the (content) route group.
 */
import type { ReactNode } from "react";
import { resolveCurrentDomain } from "@/platform/resolve";
import { publicShellFor } from "@/designs/registry";
import { publicChrome } from "@/platform/render/content";

export async function renderPublicShell({ children }: { children: ReactNode }) {
  const domain = await resolveCurrentDomain();
  const [chrome, Shell] = await Promise.all([
    publicChrome(domain.host.domain.key, domain.brand),
    publicShellFor(domain.host.publicDesign),
  ]);
  return (
    <Shell brand={domain.brand} navigation={chrome.navigation} footer={chrome.footer} articleCta={chrome.articleCta}>
      {children}
    </Shell>
  );
}
