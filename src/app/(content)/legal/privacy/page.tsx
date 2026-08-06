import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { companyLegalName, supportEmail, companyAddress } from "@/lib/branding";

export const dynamic = "force-dynamic";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <ArticleLayout eyebrow="Legal" title="Privacy Policy" description={`Last updated: July 2026. This policy describes how ${companyLegalName()} collects, uses, and protects your personal information.`}>
      <Section title="1. Information we collect">
        <p>We collect information you provide directly when you register, verify your identity, or contact us:</p>
        <ul className="list-disc pl-5 space-y-1 marker:text-brand">
          <li>Account data: name, email, country, and a generated trading account number.</li>
          <li>Identity verification (KYC): government-issued ID and proof of address, as required by regulation.</li>
          <li>Transaction data: deposits, withdrawals, and full trading history.</li>
          <li>Technical data: IP address, device type, and usage logs, used for security and fraud prevention.</li>
        </ul>
      </Section>
      <Section title="2. How we use your information">
        <ul className="list-disc pl-5 space-y-1 marker:text-brand">
          <li>To open, operate, and secure your trading account.</li>
          <li>To comply with AML/KYC and other legal obligations.</li>
          <li>To process deposits, withdrawals, and execute your orders.</li>
          <li>To provide support and improve our services.</li>
        </ul>
      </Section>
      <Section title="3. Data sharing">
        <p>We do not sell your personal data. We share it only with: regulated payment processors to move your funds; identity-verification providers to complete KYC; and competent authorities where legally required to do so. All third parties are bound by confidentiality obligations.</p>
      </Section>
      <Section title="4. Data security">
        <p>Personal data is encrypted in transit and at rest. Wallets are segregated from company funds. Access to personal data is restricted to authorised personnel on a least-privilege basis and is logged.</p>
      </Section>
      <Section title="5. Data retention">
        <p>We retain your data for as long as your account is active, and for the period required by applicable law after closure (typically 5–7 years for transaction and KYC records).</p>
      </Section>
      <Section title="6. Your rights">
        <p>Subject to applicable law, you may request access to, correction of, or deletion of your personal data, and you may object to or restrict certain processing. To exercise these rights, contact {supportEmail()}.</p>
      </Section>
      <Section title="7. Changes to this policy">
        <p>We may update this policy from time to time. Material changes will be notified by email or in-platform notice. Continued use after a change constitutes acceptance.</p>
      </Section>
      <Section title="8. Contact">
        <p>{companyLegalName()}{companyAddress() ? `, ${companyAddress()}` : ""}. Email: {supportEmail()}.</p>
      </Section>
    </ArticleLayout>
  );
}
