// Dynamic so branding values (support email, domain, brand name in the Footer
// and Hero card) are read from env at request time, not baked at build time.
export const dynamic = "force-dynamic";

/**
 * Public landing page — a thin host dispatcher.
 *
 *   request host → platform render → domain manifest → content + design
 *
 * Everything below this line lives in the platform layer; app routes never
 * touch domains or designs directly.
 */
import { renderLanding } from "@/platform/render/landing";

export default async function HomePage() {
  return await renderLanding();
}
