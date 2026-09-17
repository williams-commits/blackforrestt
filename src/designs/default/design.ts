import type { DesignManifest } from "@/designs/contracts";

/** The DEFAULT design: editorial landing + light public chrome. */
export const design: DesignManifest = {
  key: "default",
  landing: async () => (await import("./landing/DefaultLanding")).DefaultLanding,
  publicShell: async () => (await import("./public/DefaultPublicShell")).DefaultPublicShell,
  articleLayout: async () => {
    const m = await import("@/components/landing/ArticleLayout");
    return { DefaultArticleLayout: m.ArticleLayout, DefaultSection: m.Section };
  },
};
