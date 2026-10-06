import Link from "next/link";
import type { PublicDesignProps } from "@/designs/contracts";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

/**
 * DEFAULT public-page shell — the primary brand's light editorial chrome
 * (Navbar + Footer) for the (content) route group. Selected by the design
 * registry whenever a domain's publicDesign is "default" or unknown. The
 * chrome's typed content is assembled here once and passed down.
 *
 * Renders the domain's closing CTA band above the footer — the same
 * article-closing moment the gbfxs/convertio shells provide via
 * ArticleCtaProvider, expressed in the default design's editorial voice.
 */
export async function DefaultPublicShell({
  children,
  navigation,
  footer,
  articleCta,
}: PublicDesignProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar content={navigation} />
      <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
      {articleCta ? <ClosingCtaBand cta={articleCta} /> : null}
      <Footer content={footer} />
    </div>
  );
}

function ClosingCtaBand({ cta }: { cta: NonNullable<PublicDesignProps["articleCta"]> }) {
  return (
    <section className="border-t border-border-soft bg-panel py-14 lg:py-16">
      <div className="max-w-3xl mx-auto px-4 lg:px-8 text-center">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">{cta.title}</h2>
        <p className="font-prose mt-3 text-lg leading-relaxed text-text-muted">{cta.subtitle}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="px-6 py-3 rounded-lg bg-brand text-white font-semibold hover:brightness-110 transition shadow-card"
          >
            {cta.primaryLabel}
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg bg-canvas border border-border font-semibold hover:bg-panel transition"
          >
            {cta.secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
