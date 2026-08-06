import { ArticleLayout } from "@/components/landing/ArticleLayout";
import { ContactForm } from "@/components/landing/ContactForm";
import { brandName, companyAddress, supportEmail } from "@/lib/branding";

export const dynamic = "force-dynamic";

export const metadata = { title: `Contact — ${brandName()}` };

/** Server component: reads branding env vars once and passes them to the client form. */
export default function ContactPage() {
  return (
    <ArticleLayout
      eyebrow="Company"
      title="Get in touch"
      description="Our support team is available 24/7. We typically respond within one business day."
    >
      <ContactForm address={companyAddress()} email={supportEmail()} />
    </ArticleLayout>
  );
}
