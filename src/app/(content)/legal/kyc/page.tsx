import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { supportEmail, brandName } from "@/lib/branding";

export const dynamic = "force-dynamic";

export const metadata = { title: `KYC Policy — ${brandName()}` };

export default function KycPage() {
  return (
    <ArticleLayout eyebrow="Legal" title="Know Your Customer (KYC) Policy" description="Last updated: July 2026. To comply with regulation and protect our clients, we verify the identity of every customer.">
      <Section title="1. Why we verify">
        <p>Identity verification protects you and the integrity of the platform. It prevents fraud, identity theft, underage trading, and the use of the platform for money laundering. Verification is a regulatory requirement, not an optional step.</p>
      </Section>
      <Section title="2. What you'll need">
        <ul className="list-disc pl-5 space-y-1 marker:text-brand">
          <li><strong>Identity document:</strong> a valid passport, national ID card, or driving licence. The document must be legible, unexpired, and show your photo and date of birth.</li>
          <li><strong>Proof of address:</strong> a recent (under 3 months) utility bill, bank statement, or government letter showing your name and residential address.</li>
          <li><strong>Selfie:</strong> in some cases we may ask for a selfie with your document to confirm you are the holder.</li>
        </ul>
      </Section>
      <Section title="3. The verification process">
        <ol className="list-decimal pl-5 space-y-1 marker:text-brand">
          <li>Submit your documents via the Verification tab in your account.</li>
          <li>Our compliance team reviews your submission, typically within 1–2 business days.</li>
          <li>You&apos;ll be notified by email when verification is complete, approved, or if we need more information.</li>
        </ol>
      </Section>
      <Section title="4. What changes when verified">
        <p>Until verification is complete, your account can trade on the demo balance but withdrawals are disabled. Once verified, you unlock withdrawals, higher limits, and full account features.</p>
      </Section>
      <Section title="5. Re-verification">
        <p>We may periodically re-verify your identity if your documents expire, your circumstances change materially, or we identify activity that warrants it. We&apos;ll notify you in advance where possible.</p>
      </Section>
      <Section title="6. Data handling">
        <p>Your KYC documents are encrypted at rest, access-restricted, and used solely for verification and regulatory compliance. They are never sold or shared except with verification providers and competent authorities as required by law. See our Privacy Policy for details.</p>
      </Section>
      <Section title="7. Contact">
        <p>For verification queries, contact {supportEmail()} or use the Verification tab in your account.</p>
      </Section>
    </ArticleLayout>
  );
}
