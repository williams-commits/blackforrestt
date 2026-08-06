import Link from "next/link";
import { Logo } from "@/components/trade/Logo";
import { companyLegalName, supportEmail, companyAddress, brandTrademark } from "@/lib/branding";
import Image from "next/image";
const logos = [
  "/payments/visa.png",
  "/payments/mastercard.png",
  "/payments/bitcoin.jpg",
  "/payments/amex.jpg",
  "/payments/maestro.png",
  // "/payments/ethereum.png",
];

/** Marketing footer: contact, risk disclaimers, payment icons, legal. */
export function Footer() {
  return (
    <footer className="bg-text text-white/80">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-14">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand + contact */}
          <div>
            <div>
              <Logo inverted />
            </div>
            <p className="mt-4 text-sm text-white/60 max-w-xs">
              {companyLegalName()} — a premier online trading platform for forex, commodities,
              and indices.
            </p>
            <address className="mt-5 not-italic text-sm text-white/70 leading-relaxed">
              {companyAddress() ? (
                <>{companyAddress()}<br /></>
              ) : (
                <>
                    13 Ramsgate Street<br />
                    London, England, E8 2FD<br />
                </>
              )}
              <span className="text-white/50">{supportEmail()}</span>
            </address>
          </div>

          {/* Company */}
          <FooterCol title="Company" links={[["About Us", "/about"], ["Contacts", "/contact"], ["Open Account", "/register"], ["Log in", "/login"]]} />

          {/* Tools */}
          <FooterCol title="Tools" links={[["Informers", "/tools/informers"], ["Calendars", "/tools/calendars"], ["Calculators", "/tools/calculators"], ["Signals", "/tools/signals"]]} />

          {/* Legal */}
          <FooterCol title="Legal" links={[["Privacy Policy", "/legal/privacy"], ["AML Policy", "/legal/aml"], ["KYC Policy", "/legal/kyc"], ["Terms of Service", "/legal/terms"]]} />
        </div>

        {/* Payment icons */}
        <div className="mt-10 pt-8 border-t border-white/10 flex flex-wrap items-center gap-3">
          <span className="text-xs text-white/40 mr-2">We accept:</span>
          {logos.map((p) => (
            <Image key={p} src={p} alt={p} width={38} height={24}  />
          ))}
        </div>

        {/* Risk warning */}
        <div className="mt-8 text-xs text-white/45 leading-relaxed space-y-3">
          <p>
            <strong className="text-white/70">Risk Warning:</strong> Operations offered by this site
            can only be carried out by fully capable adults. Transactions in financial instruments
            offered, featured or mentioned on our website may be considered high-risk transactions
            and the carrying out of such transactions may result in the loss of all invested capital.
          </p>
          <p>
            We do not provide any services to citizens and/or residents of the United States, Syria,
            Sudan, Iran, and North Korea. Trading is only available to persons aged 18 and over.
          </p>
          <p>
            Please read our Privacy, AML, and KYC policies before opening an account. Past performance
            does not guarantee future results.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <span>© 2026 {companyLegalName()}. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <span>{brandTrademark()} is a trademark of {companyLegalName()}.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="text-white font-semibold text-sm mb-4">{title}</h4>
      <ul className="space-y-2.5">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-white/60 hover:text-white transition-colors">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
