import type { DesignManifest } from "@/designs/contracts";

/**
 * DESIGN TEMPLATE — copy this folder for a new design (or scaffold via the
 * platform CLI). The manifest is pure data; components load lazily.
 */
export const design: DesignManifest = {
  key: "__DESIGN_KEY__",
  landing: async () => (await import("./landing/TemplateLanding")).TemplateLanding,
  publicShell: async () => (await import("./public/TemplatePublicShell")).TemplatePublicShell,
};
