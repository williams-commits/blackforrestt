"use client";

/**
 * Search-palette bus: any surface (module toolbars, sidebar, future widgets)
 * opens the global command palette without prop-drilling or a provider —
 * GlobalSearch owns the dialog and listens for this event.
 */

export type SearchScope =
  | "ALL"
  | "LEAD"
  | "CONTACT"
  | "ACCOUNT"
  | "CUSTOMER"
  | "CAMPAIGN"
  | "TASK";

export function openSearchPalette(scope: SearchScope = "ALL") {
  window.dispatchEvent(new CustomEvent("crm:open-search", { detail: { scope } }));
}
