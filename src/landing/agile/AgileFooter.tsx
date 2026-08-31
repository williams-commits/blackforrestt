import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AgileMark } from "./AgileMark";
import {
  clientTradeUrl,
  brandRegistrationSummary,
  currentBrandProfile,
} from "@/lib/branding";

/**
 * Large institutional dark footer for the Agile template: brand + contact,
 * four navigation columns, registration line, and the full risk-warning
 * block — dense, small-type, high-readability. All identity text resolves
 * through the brand profile so this footer always names THIS brand, never
 * the primary.
 */
export async function AgileFooter() {
  const t = await getTranslations("footer");
  const tLinks = await getTranslations("footer.links");
  const tCols = await getTranslations("footer.columns");
  const brand = await currentBrandProfile();
  const company = brand.legalName;
  const tm = brand.trademark;
  const address = brand.address;
  const support = brand.supportEmail;
  const registration = brandRegistrationSummary(brand);

  const columns: Array<{ title: string; links: Array<[string, string]> }> = [
    {
      title: tCols("company"),
      links: [
        [tLinks("about"), "/about"],
        [tLinks("contact"), "/contact"],
        [tLinks("openAccount"), clientTradeUrl("/register")],
        [tLinks("login"), clientTradeUrl("/login")],
      ],
    },
    {
      title: tCols("tools"),
      links: [
        [tLinks("informers"), "/tools/informers"],
        [tLinks("calendars"), "/tools/calendars"],
        [tLinks("calculators"), "/tools/calculators"],
        [tLinks("signals"), "/tools/signals"],
      ],
    },
    {
      title: tCols("legal"),
      links: [
        [tLinks("privacy"), "/legal/privacy"],
        [tLinks("aml"), "/legal/aml"],
        [tLinks("kyc"), "/legal/kyc"],
        [tLinks("terms"), "/legal/terms"],
      ],
    },
  ];

  return (
    <footer className="bg-[#15181a] text-[#a7ada8]">
      <div className="ag-container py-14">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            {/* The mark renders its own home link — never wrap it in another. */}
            <AgileMark size="lg" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#747a75]">
              {t("tagline", { company })}
            </p>
            <address className="mt-5 text-sm not-italic leading-relaxed text-[#747a75]">
              {address && (
                <>
                  {address}
                  <br />
                </>
              )}
              <a href={`mailto:${support}`} className="transition-colors hover:text-[#63e891]">
                {support}
              </a>
            </address>
            {registration && (
              <p className="mt-4 border-l-2 border-[#63e891]/50 pl-3 text-xs leading-relaxed text-[#747a75]">
                {registration}
              </p>
            )}
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#f1f3ef]">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-sm transition-colors hover:text-[#63e891]">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="ag-container space-y-3 py-8 text-xs leading-relaxed text-[#747a75]">
          <p>
            <strong className="text-[#a7ada8]">{t("riskWarning")}</strong> {t("risk1")}
          </p>
          <p>{t("risk2")}</p>
          <p>{t("risk3")}</p>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <span>{t("copyright", { company })}</span>
            <span>{t("trademark", { tm, company })}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
