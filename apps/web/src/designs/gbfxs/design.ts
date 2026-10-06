import type { DesignManifest } from "@/designs/contracts";

/** The GBFXS design: dark institutional landing + public shell. */
export const design: DesignManifest = {
  key: "gbfxs",
  landing: async () => (await import("./landing/GbfxsLanding")).GbfxsLanding,
  publicShell: async () => (await import("./public/GbfxsPublicShell")).GbfxsPublicShell,
  articleLayout: async () => {
    const m = await import("./public/content/GbfxsArticleLayout");
    return { GbfxsArticleLayout: m.GbfxsArticleLayout, GbfxsSection: m.GbfxsSection };
  },
};
