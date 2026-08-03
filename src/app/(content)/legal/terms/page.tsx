import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { companyLegalName, supportEmail, companyAddress, brandName } from "@/lib/branding";

export const metadata = { title: `Terms of Service — ${brandName()}` };

export default function TermsPage() {
  return (
    <ArticleLayout eyebrow="Legal" title="Terms of Service" description={`Last updated: July 2026. These terms govern your use of the ${brandName()} platform. By opening an account you agree to be bound by them.`}>
      <Section title="1. Eligibility">
        <p>You must be at least 18 years old and legally capable of entering into a binding contract to use this platform. We do not provide services to citizens or residents of the United States, Syria, Sudan, Iran, or North Korea. You represent that you are not resident in, or trading from, any restricted jurisdiction.</p>
      </Section>
      <Section title="2. Your account">
        <p>You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. You agree to provide accurate information at registration and to keep it updated. We may suspend or close accounts that breach these terms or that we suspect of fraudulent activity.</p>
      </Section>
      <Section title="3. Risk acknowledgement">
        <p>Trading forex, CFDs, and other leveraged products carries a high level of risk and can result in the loss of all invested capital. You acknowledge that you understand these risks, that past performance does not guarantee future results, and that you are trading voluntarily with funds you can afford to lose. You should not trade with borrowed money.</p>
      </Section>
      <Section title="4. Fees and pricing">
        <p>Spreads, commissions, and swap charges are displayed in the platform before you trade. We may change our fee schedule with notice. Demo accounts carry no real financial value and are provided for practice only.</p>
      </Section>
      <Section title="5. Execution">
        <p>We aim to execute orders promptly at quoted prices. However, in fast or illiquid markets, execution may be delayed or the price may move (&quot;slippage&quot;). We are not liable for losses arising from market conditions, connectivity issues on your side, or force majeure events.</p>
      </Section>
      <Section title="6. Prohibited conduct">
        <p>You agree not to: exploit errors in pricing or software (&quot;arbitrage of system errors&quot;); use the platform for money laundering or any illegal purpose; reverse-engineer, scrape, or overload our infrastructure; or share your account. Violations may result in immediate closure and forfeiture of balances derived from prohibited activity.</p>
      </Section>
      <Section title="7. Intellectual property">
        <p>The platform, its branding, content, and software are the property of {companyLegalName()} and protected by applicable law. &quot;blckforest&quot; is a trademark of {companyLegalName()}. You may not copy, redistribute, or create derivative works without our written permission.</p>
      </Section>
      <Section title="8. Limitation of liability">
        <p>To the maximum extent permitted by law, {companyLegalName()} shall not be liable for indirect, incidental, or consequential damages, or for any loss of profit, arising from your use of the platform. Our aggregate liability is limited to the amount of fees you paid us in the preceding three months.</p>
      </Section>
      <Section title="9. Changes to these terms">
        <p>We may revise these terms periodically. Material changes will be notified by email or in-platform notice. Continued use after the effective date constitutes acceptance of the revised terms.</p>
      </Section>
      <Section title="10. Contact">
        <p>{companyLegalName()}{companyAddress() ? `, ${companyAddress()}` : ", 13 Ramsgate Street, London, England, E8 2FD"}. Email: {supportEmail()}.</p>
      </Section>
    </ArticleLayout>
  );
}
