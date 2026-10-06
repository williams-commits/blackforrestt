import Link from "next/link";
import { CreditCard, Landmark, Lock, Shield, ShieldCheck, Umbrella } from "lucide-react";
import { Logo } from "@/components/trade/Logo";
import Image from "next/image";
import type { FooterContent } from "@/content/contracts";

/**
 * Marketing footer: contact, risk disclaimers, payment icons, legal. ALL
 * copy (including the per-domain brand facts and assurance labels) arrives
 * as the typed FooterContent contract — assembled by the domain content
 * package, never fetched here.
 */
export function Footer({ content }: { content: FooterContent }) {
  const iconW = 38;
  const logos = content.paymentMethods ?? [];
  const assurance = content.assurance;

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
              {content.tagline}
            </p>
            <address className="mt-5 not-italic text-sm text-white/70 leading-relaxed">
              {content.contact.address && <>{content.contact.address}<br /></>}
              <span className="text-white/50">{content.contact.supportEmail}</span>
            </address>
          </div>

          {content.columns.map((column) => (
            <div key={column.key}>
              <h4 className="text-white font-semibold text-sm mb-4">{column.label}</h4>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-white/60 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Trading assurance — broker registration & investor protections */}
        {assurance && (
          <div className="mt-10 pt-8 border-t border-white/10 flex flex-wrap items-center gap-2.5">
            <span className="text-xs text-white/40 mr-2">{assurance.title}</span>
            <AssuranceBadge icon={<ShieldCheckIcon />} label={assurance.registration} note={content.registrationSummary || assurance.registrationNote} emphasized />
            <AssuranceBadge icon={<BankIcon />} label={assurance.segregated} />
            <AssuranceBadge icon={<UmbrellaIcon />} label={assurance.compensation} />
            <AssuranceBadge icon={<ShieldIcon />} label={assurance.protection} />
            <AssuranceBadge icon={<LockIcon />} label={assurance.security} />
            <AssuranceBadge icon={<CardIcon />} label={assurance.payments} />
          </div>
        )}

        {/* Payment icons */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center gap-3">
          {content.weAccept && <span className="text-xs text-white/40 mr-2">{content.weAccept}</span>}
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
            <strong className="text-white/70">{content.risk.heading}</strong> {content.risk.paragraphs[0]}
          </p>
          {content.risk.paragraphs.slice(1).map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <span>{content.copyright}</span>
          <div className="flex items-center gap-4">
            <span>{content.trademarkLine}</span>
          </div>
        </div>
      </div>
    </footer>
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
  return <ShieldCheck size={15} strokeWidth={2} aria-hidden />;
}

function ShieldIcon() {
  return <Shield size={15} strokeWidth={2} aria-hidden />;
}

function BankIcon() {
  return <Landmark size={15} strokeWidth={2} aria-hidden />;
}

function UmbrellaIcon() {
  return <Umbrella size={15} strokeWidth={2} aria-hidden />;
}

function LockIcon() {
  return <Lock size={15} strokeWidth={2} aria-hidden />;
}

function CardIcon() {
  return <CreditCard size={15} strokeWidth={2} aria-hidden />;
}
