import type { MetadataRoute } from "next";
import { brandName, brandShortName } from "@/lib/branding";

/**
 * Web app manifest for installable PWA support and Android Chrome.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brandName(),
    short_name: brandShortName(),
    description: "Multi-asset online trading platform for forex, commodities, indices and crypto.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#fd7e14",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
