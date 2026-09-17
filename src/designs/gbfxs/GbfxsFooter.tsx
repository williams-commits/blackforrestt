import Link from "next/link";
import { AgileMark } from "./AgileMark";
import type { FooterContent } from "@/content/contracts";

/**
 * Large institutional dark footer for the Agile template: brand + contact,
 * four navigation columns, registration line, and the full risk-warning
 * block — dense, small-type, high-readability. ALL identity text arrives as
 * the typed FooterContent contract (resolved against this brand family by
 * the domain content package) — this footer always names THIS brand, never
 * the primary.
 */
export function AgileFooter({ content }: { content: FooterContent }) {
  return (
    <footer className="bg-[#151517] text-[#a9a9ae]">
      <div className="ag-container py-14">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            {/* The mark renders its own home link — never wrap it in another. */}
            <AgileMark size="lg" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#75757b]">
              {content.tagline}
            </p>
            <address className="mt-5 text-sm not-italic leading-relaxed text-[#75757b]">
              {content.contact.address && (
                <>
                  {content.contact.address}
                  <br />
                </>
              )}
              <a href={`mailto:${content.contact.supportEmail}`} className="transition-colors hover:text-[#f0b90b]">
                {content.contact.supportEmail}
              </a>
            </address>
            {content.registrationSummary && (
              <p className="mt-4 border-l-2 border-[#f0b90b]/50 pl-3 text-xs leading-relaxed text-[#75757b]">
                {content.registrationSummary}
              </p>
            )}
          </div>

          {content.columns.map((column) => (
            <nav key={column.key} aria-label={column.label}>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#f1f3ef]">
                {column.label}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm transition-colors hover:text-[#f0b90b]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="ag-container space-y-3 py-8 text-xs leading-relaxed text-[#75757b]">
          <p>
            <strong className="text-[#a9a9ae]">{content.risk.heading}</strong> {content.risk.paragraphs[0]}
          </p>
          {content.risk.paragraphs.slice(1).map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <span>{content.copyright}</span>
            <span>{content.trademarkLine}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
