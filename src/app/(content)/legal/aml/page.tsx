import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { companyLegalName, supportEmail, brandName } from "@/lib/branding";

export const metadata = { title: `AML Policy — ${brandName()}` };

export default function AmlPage() {
  return (
    <ArticleLayout eyebrow="Legal" title="Anti-Money Laundering Policy" description={`Last updated: July 2026. ${companyLegalName()} is committed to preventing money laundering, terrorist financing, and financial crime.`}>
      <Section title="1. Purpose">
        <p>This Anti-Money Laundering (AML) and Counter-Terrorist Financing (CTF) policy sets out the procedures we follow to detect, prevent, and report attempts to use our platform for illicit purposes, in accordance with applicable laws and regulations.</p>
      </Section>
      <Section title="2. Customer Due Diligence (CDD)">
        <p>We perform identity verification on every customer before enabling withdrawals and full account functionality. This includes verifying a government-issued identity document and, where required, proof of address and source of funds.</p>
      </Section>
      <Section title="3. Enhanced Due Diligence (EDD)">
        <p>For customers classified as higher risk — including those from higher-risk jurisdictions, politically exposed persons (PEPs), or those with complex ownership structures — we apply enhanced due diligence, including additional documentation and senior-management approval.</p>
      </Section>
      <Section title="4. Transaction monitoring">
        <p>We monitor transactions for unusual or suspicious patterns, including structuring, rapid round-tripping of funds, and activity inconsistent with a customer&apos;s profile. Suspicious activity is investigated and, where required, reported to the relevant Financial Intelligence Unit.</p>
      </Section>
      <Section title="5. Sanctions screening">
        <p>All customers and transactions are screened against applicable sanctions lists. We do not provide services to citizens or residents of the United States, Syria, Sudan, Iran, or North Korea, or to any sanctioned individual or entity.</p>
      </Section>
      <Section title="6. Record keeping">
        <p>We retain CDD records, transaction records, and AML investigation files for a minimum of five years after the end of the customer relationship, or longer where required by law.</p>
      </Section>
      <Section title="7. Reporting">
        <p>Suspicious transactions are reported to the competent authority. It is an offence to tip off a customer about a suspicious-activity report. Our designated AML officer oversees this policy and all reporting.</p>
      </Section>
      <Section title="8. Contact">
        <p>For AML enquiries, contact our compliance team at {supportEmail()}.</p>
      </Section>
    </ArticleLayout>
  );
}
