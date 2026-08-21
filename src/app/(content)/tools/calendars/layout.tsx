import { getTranslations } from "next-intl/server";
import { contentMetadata } from "@/lib/seo";

/** Server layout so this client-component route exports real metadata —
 *  without it the page inherits the root layout's canonical "/" and tells
 *  search engines it is a duplicate of the homepage. */
export async function generateMetadata() {
  const t = await getTranslations("calendars");
  return contentMetadata("/tools/calendars", t("metaTitle"));
}

export default function CalendarsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
