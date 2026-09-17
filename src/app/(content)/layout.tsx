/**
 * Shared layout for the marketing content pages (About, Tools, Analytics,
 * Education, Legal) — a thin host dispatcher into the platform layer, which
 * resolves the domain's public design shell and chrome content.
 */
import { renderPublicShell } from "@/platform/render/public";

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  return await renderPublicShell({ children });
}
