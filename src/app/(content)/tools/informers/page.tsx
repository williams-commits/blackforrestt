import { InformersWidget } from "@/components/landing/InformersWidget";
import { brandDomain } from "@/lib/branding";

export const dynamic = "force-dynamic";

export const metadata = { title: "Market Informers" };

/** Server component: reads the brand domain once and passes it to the client widget. */
export default function InformersPage() {
  return <InformersWidget domain={brandDomain()} />;
}
