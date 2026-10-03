export interface NotificationLinkRow {
  type?: string;
  payload: Record<string, unknown>;
}

const TASK_DETAIL = /^\/tasks\/[^/?#]+$/;

/** The tab that holds a notification's content on its destination page. */
function tabFor(type: string, href: string): string | null {
  switch (type) {
    case "COMMENT_ADDED":
      // Comments on tasks live in the task's Comments tab; comments on
      // notes/appointments live in the record's Activity strips.
      return TASK_DETAIL.test(href) ? "comments" : "activity";
    case "NOTE_ADDED":
    case "APPOINTMENT_SCHEDULED":
      return "activity";
    default:
      // TASK_*, RECORD_*, STAGE_*, WON/LOST and import notifications target
      // the page's primary content — no tab deep link.
      return null;
  }
}

function withTab(href: string, tab: string): string {
  return href.includes("?") ? `${href}&tab=${tab}` : `${href}?tab=${tab}`;
}

/**
 * Resolve a notification to an internal CRM destination. New notifications
 * carry `payload.context.href`; the legacy fallbacks preserve navigation for
 * notifications created before contexts were added. Every inbox entry gets a
 * safe destination, even when its original record is no longer available.
 *
 * Enterprise deep links: when the notification's content lives on a specific
 * tab of the destination page (comments, activity), the href carries
 * `?tab=` so the click lands on the exact section.
 */
export function notificationHref(notification: NotificationLinkRow): string {
  const context = notification.payload.context;
  let href: string | null = null;
  if (context && typeof context === "object" && !Array.isArray(context)) {
    const candidate = (context as { href?: unknown }).href;
    if (typeof candidate === "string" && candidate.startsWith("/") && !candidate.startsWith("//")) {
      href = candidate;
    }
  }

  if (!href) {
    const customerId = notification.payload.customerId;
    if (typeof customerId === "string") {
      href = `/customers/${customerId}`;
    } else {
      const recordId = notification.payload.recordId;
      const recordType = notification.payload.recordType;
      const collection = typeof recordType === "string"
        ? ({ LEAD: "leads", CONTACT: "contacts", ACCOUNT: "accounts", CUSTOMER: "customers", OPPORTUNITY: "opportunities" } as Record<string, string>)[recordType]
        : undefined;
      if (collection && typeof recordId === "string") {
        href = `/${collection}/${recordId}`;
      } else if (typeof notification.payload.jobId === "string") {
        href = "/imports";
      } else if (typeof notification.payload.taskId === "string") {
        href = `/tasks/${notification.payload.taskId}`;
      } else {
        // SYSTEM and older malformed notifications still open a meaningful inbox.
        href = "/";
      }
    }
  }

  const tab = tabFor(notification.type ?? "", href);
  return tab ? withTab(href, tab) : href;
}
