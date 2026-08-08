import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/trade/Logo";
import { companyLegalName, supportEmail, companyAddress, brandTrademark, clientTradeUrl } from "@/lib/branding";
import Image from "next/image";

interface PaymentLogo {
  src: string;
  alt: string;
  /** Natural aspect ratio (width / height) used to avoid distortion. */
  aspect: number;
}

// Payment method logos. width is fixed at 38px; height is derived from the
// natural aspect ratio so icons aren't squashed. All source images are in
// public/payments/.
const logos: PaymentLogo[] = [
  { src: "/payments/visa.png", alt: "Visa", aspect: 1200 / 762 },
  { src: "/payments/mastercard.png", alt: "Mastercard", aspect: 1280 / 995 },
  { src: "/payments/maestro.png", alt: "Maestro", aspect: 2000 / 1227 },
  { src: "/payments/amex.jpg", alt: "American Express", aspect: 1790 / 1106 },
  { src: "/payments/bitcoin.png", alt: "Bitcoin", aspect: 849 / 255 },
];

/** Marketing footer: contact, risk disclaimers, payment icons, legal. */
export async function Footer() {
  const t = await getTranslations("footer");
  const tLinks = await getTranslations("footer.links");
  const tCols = await getTranslations("footer.columns");
  const iconW = 38;
  const company = companyLegalName();
  const tm = brandTrademark();

  return (
    <footer className="bg-surface-dark text-white/80">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-14">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand + contact */}
          <div>
            <div>
              <Logo inverted />
            </div>
            <p className="mt-4 text-sm text-white/60 max-w-xs">
              {t("tagline", { company })}
            </p>
            <address className="mt-5 not-italic text-sm text-white/70 leading-relaxed">
              {companyAddress() && <>{companyAddress()}<br /></>}
              <span className="text-white/50">{supportEmail()}</span>
            </address>
          </div>

          {/* Company */}
          <FooterCol title={tCols("company")} linkLabels={{
            about: tLinks("about"), contact: tLinks("contact"),
            openAccount: tLinks("openAccount"), login: tLinks("login"),
          }} links={[
            ["about", "/about"],
            ["contact", "/contact"],
            ["openAccount", clientTradeUrl("/register")],
            ["login", clientTradeUrl("/login")],
          ]} />

          {/* Tools */}
          <FooterCol title={tCols("tools")} linkLabels={{
            informers: tLinks("informers"), calendars: tLinks("calendars"),
            calculators: tLinks("calculators"), signals: tLinks("signals"),
          }} links={[
            ["informers", "/tools/informers"],
            ["calendars", "/tools/calendars"],
            ["calculators", "/tools/calculators"],
            ["signals", "/tools/signals"],
          ]} />

          {/* Legal */}
          <FooterCol title={tCols("legal")} linkLabels={{
            privacy: tLinks("privacy"), aml: tLinks("aml"),
            kyc: tLinks("kyc"), terms: tLinks("terms"),
          }} links={[
            ["privacy", "/legal/privacy"],
            ["aml", "/legal/aml"],
            ["kyc", "/legal/kyc"],
            ["terms", "/legal/terms"],
          ]} />
        </div>

        {/* Payment icons */}
        <div className="mt-10 pt-8 border-t border-white/10 flex flex-wrap items-center gap-3">
          <span className="text-xs text-white/40 mr-2">{t("weAccept")}</span>
          {logos.map((logo) => (
            <Image
              key={logo.src}
              src={logo.src}
              alt={logo.alt}
              width={iconW}
              height={Math.round(iconW / logo.aspect)}
              sizes="38px"
              className="object-contain opacity-70"
            />
          ))}
        </div>

        {/* Risk warning */}
        <div className="mt-8 text-xs text-white/45 leading-relaxed space-y-3 font-prose">
          <p>
            <strong className="text-white/70">{t("riskWarning")}</strong> {t("risk1")}
          </p>
          <p>{t("risk2")}</p>
          <p>{t("risk3")}</p>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <span>{t("copyright", { company })}</span>
          <div className="flex items-center gap-4">
            <span>{t("trademark", { tm, company })}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, linkLabels, links }: { title: string; linkLabels: Record<string, string>; links: [string, string][] }) {
  return (
    <div>
      <h4 className="text-white font-semibold text-sm mb-4">{title}</h4>
      <ul className="space-y-2.5">
        {links.map(([key, href]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-white/60 hover:text-white transition-colors">
              {linkLabels[key]}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
