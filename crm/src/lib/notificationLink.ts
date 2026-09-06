export interface NotificationLinkRow {
  payload: Record<string, unknown>;
}

/**
 * Resolve a notification to an internal CRM destination. New notifications
 * carry `payload.context.href`; the legacy fallbacks preserve navigation for
 * notifications created before contexts were added. Every inbox entry gets a
 * safe destination, even when its original record is no longer available.
 */
export function notificationHref(notification: NotificationLinkRow): string {
  const context = notification.payload.context;
  if (context && typeof context === "object" && !Array.isArray(context)) {
    const href = (context as { href?: unknown }).href;
    if (typeof href === "string" && href.startsWith("/") && !href.startsWith("//")) return href;
  }

  const customerId = notification.payload.customerId;
  if (typeof customerId === "string") return `/customers/${customerId}`;
  const recordId = notification.payload.recordId;
  const recordType = notification.payload.recordType;
  const collection = typeof recordType === "string"
    ? ({ LEAD: "leads", CONTACT: "contacts", ACCOUNT: "accounts", CUSTOMER: "customers", OPPORTUNITY: "opportunities" } as Record<string, string>)[recordType]
    : undefined;
  if (collection && typeof recordId === "string") return `/${collection}/${recordId}`;
  if (typeof notification.payload.jobId === "string") return "/imports";
  if (typeof notification.payload.taskId === "string") return "/tasks";

  // SYSTEM and older malformed notifications still open a meaningful inbox.
  return "/";
}
