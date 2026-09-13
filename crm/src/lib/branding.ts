import "server-only";

/**
 * Deployment branding, resolved from the environment so one .env change
 * rebrands every surface (browser title, sidebar, login, admin copy).
 *
 *   BRANDING_NAME="Collo CRM"       — full product name shown to users
 *   BRANDING_SINGLE_NAME="Collo"    — short name used inside sentences
 *   BRANDING_LOGO="C"               — single-character logo mark
 */
export interface CrmBranding {
  name: string;
  short: string;
  logo: string;
}

export function crmBranding(): CrmBranding {
  const name = process.env.BRANDING_NAME?.trim() || "Collo CRM";
  const short = process.env.BRANDING_SINGLE_NAME?.trim() || name.split(/\s+/)[0] || "CRM";
  const logo = process.env.BRANDING_LOGO?.trim() || name.charAt(0).toUpperCase() || "C";
  return { name, short, logo };
}
