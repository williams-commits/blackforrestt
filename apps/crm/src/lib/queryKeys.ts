/**
 * TanStack Query key factory — the one vocabulary for cache keys across the
 * CRM. Structured [resource, identifier, …params] so invalidation can stop
 * at any level: `["notifications"]` refetches every notifications query,
 * `["activities", type, id]` just one record's strips.
 *
 * Keys are declared next to nothing else — components import the factory
 * instead of hand-rolling arrays, so an invalidation can never miss because
 * of a typo'd literal.
 */
export const queryKeys = {
  me: ["me"] as const,

  dashboard: ["dashboard"] as const,

  notifications: {
    /** Root — invalidates every notifications query (list + counts). */
    root: ["notifications"] as const,
    /** The bell's recent-list (default /api/notifications payload). */
    recent: ["notifications", "recent"] as const,
    /** The notification center's filtered, paginated list. */
    center: (filter: { read: string; type: string; page: number }) =>
      ["notifications", "center", filter] as const,
    /** The bell's cheap unread-count poll. */
    counts: ["notifications", "counts"] as const,
  },

  records: {
    /** Root for one object — invalidates every page/filter of that list. */
    all: (object: string) => ["records", object] as const,
    /** One page/filter combination of a record list. */
    list: (object: string, filter: Record<string, unknown>) =>
      ["records", object, filter] as const,
  },

  record: (subjectType: string, subjectId: string) => ["record", subjectType, subjectId] as const,
  /** Customer 360: live trading context for a linked platform user. */
  tradingContext: (customerId: string) => ["customers", customerId, "trading-context"] as const,

  activities: {
    /** Root for one subject's activity strips (notes + tasks). */
    all: (subjectType: string, subjectId: string) => ["activities", subjectType, subjectId] as const,
    notes: (subjectType: string, subjectId: string) => ["activities", subjectType, subjectId, "notes"] as const,
    tasks: (subjectType: string, subjectId: string) => ["activities", subjectType, subjectId, "tasks"] as const,
  },

  tasks: {
    root: ["tasks"] as const,
    /** The dashboard's "my work queue" widget (mine=1 counters + next actions). */
    widget: ["tasks", "widget"] as const,
    detail: (taskId: string) => ["tasks", "detail", taskId] as const,
    viewers: (taskId: string) => ["tasks", "viewers", taskId] as const,
  },

  directories: {
    users: ["directories", "users"] as const,
    teams: ["directories", "teams"] as const,
  },
} as const;
