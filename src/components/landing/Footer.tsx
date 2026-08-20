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
  const tA = await getTranslations("footer.assurance");
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

        {/* Trading assurance — broker registration & investor protections */}
        <div className="mt-10 pt-8 border-t border-white/10 flex flex-wrap items-center gap-2.5">
          <span className="text-xs text-white/40 mr-2">{tA("title")}</span>
          <AssuranceBadge icon={<ShieldCheckIcon />} label={tA("registration")} note={tA("registrationNote")} emphasized />
          <AssuranceBadge icon={<BankIcon />} label={tA("segregated")} />
          <AssuranceBadge icon={<UmbrellaIcon />} label={tA("compensation")} />
          <AssuranceBadge icon={<ShieldIcon />} label={tA("protection")} />
          <AssuranceBadge icon={<LockIcon />} label={tA("security")} />
          <AssuranceBadge icon={<CardIcon />} label={tA("payments")} />
        </div>

        {/* Payment icons */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center gap-3">
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

/** Trust badge: icon + label (and optional small sublabel for the
 *  registration/license item) styled to match the dark footer. */
function AssuranceBadge({ icon, label, note, emphasized = false }: { icon: React.ReactNode; label: string; note?: string; emphasized?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 ${emphasized ? "border-brand/50 bg-brand/10" : "border-white/10 bg-white/5"}`}>
      <span className="text-brand shrink-0" aria-hidden="true">{icon}</span>
      {note ? (
        <span className="leading-tight">
          <span className="block text-[11px] font-semibold text-white/80">{label}</span>
          <span className="block text-[10px] text-white/50">{note}</span>
        </span>
      ) : (
        <span className="text-[11px] text-white/70">{label}</span>
      )}
    </span>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3z" />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10l9-7 9 7" />
      <path d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9" />
      <path d="M3 21h18" />
    </svg>
  );
}

function UmbrellaIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 0 1 10 10H2A10 10 0 0 1 12 2z" />
      <path d="M12 12v6a2 2 0 0 0 4 0" />
      <path d="M12 2v1" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  );
}
