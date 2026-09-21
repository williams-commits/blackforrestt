/**
 * Serializable UI configuration for the four core record objects. Shared by
 * client list/form components — presentation only; all authorization and
 * business rules live in the server service layer.
 */

/**
 * Objects rendered by the shared RecordListPage engine. The four RECORD
 * objects have full record capabilities (bulk, views, export, merge);
 * campaigns and tasks run the same table experience with object-specific
 * gating (see RecordListPage's capability resolution).
 */
export type RecordObjectKey = "leads" | "contacts" | "accounts" | "customers";
export type ObjectKey = RecordObjectKey | "campaigns" | "tasks";

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "select"
  | "date"
  | "datetime-local"
  | "textarea";

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Static options, or a dynamic source resolved client-side. */
  options?: Array<{ value: string; label: string }>;
  optionsFrom?:
    | "leadStatuses"
    | "accountStatuses"
    | "potentialStatuses"
    | "contactStatuses"
    | "customerStatuses"
    | "users"
    | "accounts"
    | "contacts"
    | "campaigns";
  placeholder?: string;
}

export interface ColumnConfig {
  /** Dot-path into the row object, e.g. "assignedUser.name". */
  key: string;
  label: string;
  type?: "text" | "badge" | "date" | "datetime" | "number" | "email" | "record";
  /** For type "record": which object the row links into for the name column. */
  object?: ObjectKey;
  /**
   * Only columns backed by a server sort whitelist render a sort control —
   * every other header used to look clickable but silently fell back to
   * the default sort. Date/number columns default to descending first.
   */
  sortable?: boolean;
}

export interface FilterConfig {
  name: string;
  label: string;
  type: "select";
  optionsFrom?: "leadStatuses" | "accountStatuses" | "contactStatuses" | "customerStatuses";
  options?: Array<{ value: string; label: string }>;
  /** Label for the empty option — defaults to "all". */
  emptyLabel?: string;
}

export interface RecordUiConfig {
  object: ObjectKey;
  title: string;
  singular: string;
  /** API permission gates (cosmetic; the server enforces independently). */
  can: { create: string; edit: string; delete: string };
  columns: ColumnConfig[];
  filters: FilterConfig[];
  fields: FieldConfig[];
  searchPlaceholder: string;
}

export const RECORD_UI: Record<ObjectKey, RecordUiConfig> = {
  leads: {
    object: "leads",
    title: "Leads",
    singular: "Lead",
    can: { create: "LEADS_CREATE", edit: "LEADS_EDIT", delete: "LEADS_DELETE" },
    columns: [
      { key: "firstName lastName", label: "Name", type: "record", object: "leads", sortable: true },
      { key: "company", label: "Company" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
      { key: "status.name", label: "Status", type: "badge" },
      { key: "potentialStatus.name", label: "Potential", type: "badge" },
      { key: "priority", label: "Priority" },
      { key: "score", label: "Score", type: "number", sortable: true },
      { key: "assignedUser.name", label: "Assignee" },
      { key: "createdAt", label: "Created", type: "date", sortable: true },
    ],
    filters: [{ name: "statusId", label: "Status", type: "select", optionsFrom: "leadStatuses" }],
    fields: [
      { name: "firstName", label: "First name", type: "text", required: true },
      { name: "lastName", label: "Last name", type: "text", required: true },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone", type: "tel" },
      { name: "company", label: "Company", type: "text" },
      { name: "country", label: "Country", type: "text" },
      { name: "source", label: "Source", type: "text", placeholder: "WEB_FORM, REFERRAL…" },
      { name: "statusId", label: "Status", type: "select", optionsFrom: "leadStatuses" },
      { name: "potentialStatusId", label: "Potential status", type: "select", optionsFrom: "potentialStatuses" },
      {
        name: "priority",
        label: "Priority",
        type: "select",
        options: [
          { value: "LOW", label: "Low" },
          { value: "NORMAL", label: "Normal" },
          { value: "HIGH", label: "High" },
          { value: "URGENT", label: "Urgent" },
        ],
      },
      { name: "score", label: "Score (0–100)", type: "number" },
      { name: "nextFollowUpAt", label: "Next follow-up", type: "datetime-local" },
      { name: "externalId", label: "External ID", type: "text" },
      { name: "assignedUserId", label: "Assignee", type: "select", optionsFrom: "users" },
      { name: "campaignId", label: "Campaign", type: "select", optionsFrom: "campaigns" },
    ],
    searchPlaceholder: "Search all fields — name, email, phone, company, country, source…",
  },
  contacts: {
    object: "contacts",
    title: "Contacts",
    singular: "Contact",
    can: { create: "CONTACTS_CREATE", edit: "CONTACTS_EDIT", delete: "CONTACTS_DELETE" },
    columns: [
      { key: "firstName lastName", label: "Name", type: "record", object: "contacts", sortable: true },
      { key: "jobTitle", label: "Title" },
      { key: "email", label: "Email", type: "email", sortable: true },
      { key: "phone", label: "Phone" },
      { key: "account.name", label: "Account", type: "record", object: "accounts" },
      { key: "status.name", label: "Status", type: "badge" },
      { key: "owner.name", label: "Owner" },
      { key: "createdAt", label: "Created", type: "date", sortable: true },
    ],
    filters: [{ name: "statusId", label: "Status", type: "select", optionsFrom: "contactStatuses" }],
    fields: [
      { name: "firstName", label: "First name", type: "text", required: true },
      { name: "lastName", label: "Last name", type: "text", required: true },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone", type: "tel" },
      { name: "jobTitle", label: "Job title", type: "text" },
      { name: "accountId", label: "Account", type: "select", optionsFrom: "accounts" },
      { name: "leadSource", label: "Lead source", type: "text" },
      { name: "statusId", label: "Status", type: "select", optionsFrom: "contactStatuses" },
      { name: "externalId", label: "External ID", type: "text" },
      { name: "ownerUserId", label: "Owner", type: "select", optionsFrom: "users" },
      { name: "campaignId", label: "Campaign", type: "select", optionsFrom: "campaigns" },
    ],
    searchPlaceholder: "Search all fields — name, email, phone, title, source, external ID…",
  },
  accounts: {
    object: "accounts",
    title: "Accounts",
    singular: "Account",
    can: { create: "ACCOUNTS_CREATE", edit: "ACCOUNTS_EDIT", delete: "ACCOUNTS_DELETE" },
    columns: [
      { key: "name", label: "Account", type: "record", object: "accounts", sortable: true },
      { key: "industry", label: "Industry" },
      { key: "companySize", label: "Size" },
      { key: "country", label: "Country" },
      { key: "status.name", label: "Status", type: "badge" },
      { key: "_count.contacts", label: "Contacts", type: "number" },
      { key: "owner.name", label: "Owner" },
      { key: "createdAt", label: "Created", type: "date", sortable: true },
    ],
    filters: [{ name: "statusId", label: "Status", type: "select", optionsFrom: "accountStatuses" }],
    fields: [
      { name: "name", label: "Account name", type: "text", required: true },
      { name: "industry", label: "Industry", type: "text" },
      { name: "companySize", label: "Company size", type: "text", placeholder: "1-10, 11-50…" },
      { name: "revenue", label: "Annual revenue (minor units)", type: "number" },
      { name: "website", label: "Website", type: "text", placeholder: "https://…" },
      { name: "addressLine", label: "Address", type: "text" },
      { name: "city", label: "City", type: "text" },
      { name: "country", label: "Country", type: "text" },
      { name: "externalId", label: "External ID", type: "text" },
      { name: "statusId", label: "Status", type: "select", optionsFrom: "accountStatuses" },
      { name: "ownerUserId", label: "Owner", type: "select", optionsFrom: "users" },
    ],
    searchPlaceholder: "Search all fields — name, industry, size, city, country, website…",
  },
  customers: {
    object: "customers",
    title: "Customers",
    singular: "Customer",
    can: { create: "CUSTOMERS_CREATE", edit: "CUSTOMERS_EDIT", delete: "CUSTOMERS_DELETE" },
    columns: [
      { key: "firstName lastName", label: "Name", type: "record", object: "customers", sortable: true },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
      { key: "status.name", label: "Status", type: "badge" },
      { key: "source", label: "Source" },
      { key: "contact.firstName lastName", label: "Linked contact" },
      { key: "owner.name", label: "Owner" },
      { key: "createdAt", label: "Created", type: "date", sortable: true },
    ],
    filters: [{ name: "statusId", label: "Status", type: "select", optionsFrom: "customerStatuses" }],
    fields: [
      { name: "firstName", label: "First name", type: "text", required: true },
      { name: "lastName", label: "Last name", type: "text", required: true },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone", type: "tel" },
      { name: "source", label: "Source", type: "text" },
      { name: "statusId", label: "Status", type: "select", optionsFrom: "customerStatuses" },
      { name: "contactId", label: "Linked contact", type: "select", optionsFrom: "contacts" },
      { name: "ownerUserId", label: "Owner", type: "select", optionsFrom: "users" },
      { name: "campaignId", label: "Campaign", type: "select", optionsFrom: "campaigns" },
    ],
    searchPlaceholder: "Search all fields — name, email, phone, source…",
  },
  campaigns: {
    object: "campaigns",
    title: "Campaigns",
    singular: "Campaign",
    can: { create: "CAMPAIGNS_CREATE", edit: "CAMPAIGNS_EDIT", delete: "CAMPAIGNS_DELETE" },
    columns: [
      { key: "name", label: "Campaign", type: "record", object: "campaigns", sortable: true },
      { key: "status", label: "Status", type: "badge" },
      { key: "source", label: "Source" },
      { key: "memberCount", label: "Members", type: "number" },
      { key: "owner.name", label: "Owner" },
      { key: "startsAt", label: "Starts", type: "date" },
      { key: "createdAt", label: "Created", type: "date", sortable: true },
    ],
    filters: [
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "DRAFT", label: "Draft" },
          { value: "ACTIVE", label: "Active" },
          { value: "PAUSED", label: "Paused" },
          { value: "COMPLETED", label: "Completed" },
        ],
      },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "source", label: "Source", type: "text" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "DRAFT", label: "Draft" },
          { value: "ACTIVE", label: "Active" },
          { value: "PAUSED", label: "Paused" },
          { value: "COMPLETED", label: "Completed" },
        ],
      },
      { name: "startsAt", label: "Starts", type: "datetime-local" },
      { name: "endsAt", label: "Ends", type: "datetime-local" },
    ],
    searchPlaceholder: "Search all fields — name, description, source, owner…",
  },
  tasks: {
    object: "tasks",
    title: "Tasks",
    singular: "Task",
    can: { create: "TASKS_CREATE", edit: "TASKS_EDIT", delete: "TASKS_DELETE" },
    columns: [
      { key: "title", label: "Task", type: "record", object: "tasks" },
      { key: "dueAt", label: "Due", type: "datetime" },
      { key: "priority", label: "Priority", type: "badge" },
      { key: "owner.name", label: "Owner" },
      { key: "status", label: "Status", type: "badge" },
      { key: "createdAt", label: "Created", type: "date" },
    ],
    filters: [
      {
        name: "status",
        label: "Status",
        type: "select",
        emptyLabel: "active",
        options: [
          { value: "OPEN", label: "Open" },
          { value: "IN_PROGRESS", label: "In progress" },
          { value: "COMPLETED", label: "Completed" },
          { value: "CANCELLED", label: "Cancelled" },
        ],
      },
      {
        name: "priority",
        label: "Priority",
        type: "select",
        options: [
          { value: "URGENT", label: "Urgent" },
          { value: "HIGH", label: "High" },
          { value: "NORMAL", label: "Normal" },
          { value: "LOW", label: "Low" },
        ],
      },
      {
        name: "due",
        label: "Due",
        type: "select",
        options: [
          { value: "overdue", label: "Overdue" },
          { value: "today", label: "Today" },
          { value: "week", label: "Next 7 days" },
          { value: "upcoming", label: "Upcoming" },
          { value: "all", label: "Any time" },
        ],
      },
      {
        name: "mine",
        label: "Ownership",
        type: "select",
        options: [
          { value: "1", label: "My & shared" },
          { value: "0", label: "Everyone (admins)" },
        ],
      },
    ],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "dueAt", label: "Due", type: "datetime-local" },
      {
        name: "priority",
        label: "Priority",
        type: "select",
        options: [
          { value: "LOW", label: "Low" },
          { value: "NORMAL", label: "Normal" },
          { value: "HIGH", label: "High" },
          { value: "URGENT", label: "Urgent" },
        ],
      },
      {
        name: "recurrence",
        label: "Repeat",
        type: "select",
        options: [
          { value: "NONE", label: "Does not repeat" },
          { value: "DAILY", label: "Daily" },
          { value: "WEEKLY", label: "Weekly" },
          { value: "MONTHLY", label: "Monthly" },
        ],
      },
      { name: "reminderAt", label: "Reminder", type: "datetime-local" },
      { name: "ownerUserId", label: "Owner", type: "select", optionsFrom: "users" },
    ],
    searchPlaceholder: "Search all fields — title, description, owner…",
  },
};
