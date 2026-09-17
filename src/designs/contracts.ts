/**
 * Design system contracts — WHAT a design package must expose.
 *
 * A design manifest is PURE DATA (lazy component refs, no React execution at
 * import time) so scripts and generated registries can import it safely.
 *
 * ARCHITECTURE (content/design separation):
 *   CONTENT  = WHAT is shown   (typed contracts from src/content)
 *   DESIGN   = HOW it is shown (this layer — receives content via props)
 *   DOMAIN   = WHICH content/design (domain.config.ts)
 *   PLATFORM = COMPOSES them   (src/platform/render)
 *
 * Design packages NEVER import domain content implementations — the platform
 * renderer resolves the domain's content and feeds it in as props.
 */
import type { ComponentType, ReactNode } from "react";
import type { BrandProfile } from "@/lib/branding";
import type {
  ArticleClosingCta,
  FooterContent,
  LandingPageContent,
  NavigationContent,
} from "@/content/contracts";

/** Everything a landing design receives: landing content + chrome + brand. */
export interface LandingDesignProps {
  content: {
    landing: LandingPageContent;
    navigation: NavigationContent;
    footer: FooterContent;
  };
  brand: BrandProfile;
}

/** Everything a public shell receives: shared page bodies + chrome + brand. */
export interface PublicDesignProps {
  children: ReactNode;
  brand: BrandProfile;
  navigation: NavigationContent;
  footer: FooterContent;
  articleCta: ArticleClosingCta;
}

/** Pure-data design manifest — lazy component refs only. */
export interface DesignManifest {
  key: string;
  /** Async server component for the apex "/" page. */
  landing: () => Promise<ComponentType<LandingDesignProps>>;
  /** Async server shell for the (content) route group. */
  publicShell: () => Promise<ComponentType<PublicDesignProps>>;
  /** Client-safe article layout ref for the (content) composition layer. */
  articleLayout?: () => Promise<{ GbfxsArticleLayout?: unknown; DefaultArticleLayout?: unknown; [key: string]: unknown }>;
}
