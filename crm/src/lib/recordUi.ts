/**
 * Serializable UI configuration for the four core record objects. Shared by
 * client list/form components — presentation only; all authorization and
 * business rules live in the server service layer.
 */

export type ObjectKey = "leads" | "contacts" | "accounts" | "customers";

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
}

export interface FilterConfig {
  name: string;
  label: string;
  type: "select";
  optionsFrom?: "leadStatuses" | "contactStatuses" | "customerStatuses";
  options?: Array<{ value: string; label: string }>;
}

export interface RecordUiConfig {
  object: ObjectKey;
  title: string;
  singular: string;
  /** API permission gates (cosmetic; the server enforces independently). */
  can: { create: string; edit: string; delete: string; assign?: string };
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
    can: { create: "LEADS_CREATE", edit: "LEADS_EDIT", delete: "LEADS_DELETE", assign: "LEADS_ASSIGN" },
    columns: [
      { key: "firstName lastName", label: "Name", type: "record", object: "leads" },
      { key: "company", label: "Company" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
      { key: "status.name", label: "Status", type: "badge" },
      { key: "priority", label: "Priority" },
      { key: "score", label: "Score", type: "number" },
      { key: "assignedUser.name", label: "Assignee" },
      { key: "createdAt", label: "Created", type: "date" },
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
    searchPlaceholder: "Search name, email, phone, company…",
  },
  contacts: {
    object: "contacts",
    title: "Contacts",
    singular: "Contact",
    can: { create: "CONTACTS_CREATE", edit: "CONTACTS_EDIT", delete: "CONTACTS_DELETE" },
    columns: [
      { key: "firstName lastName", label: "Name", type: "record", object: "contacts" },
      { key: "jobTitle", label: "Title" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
      { key: "account.name", label: "Account", type: "record", object: "accounts" },
      { key: "status.name", label: "Status", type: "badge" },
      { key: "owner.name", label: "Owner" },
      { key: "createdAt", label: "Created", type: "date" },
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
    searchPlaceholder: "Search name, email, phone, title…",
  },
  accounts: {
    object: "accounts",
    title: "Accounts",
    singular: "Account",
    can: { create: "ACCOUNTS_CREATE", edit: "ACCOUNTS_EDIT", delete: "ACCOUNTS_DELETE" },
    columns: [
      { key: "name", label: "Account", type: "record", object: "accounts" },
      { key: "industry", label: "Industry" },
      { key: "companySize", label: "Size" },
      { key: "country", label: "Country" },
      { key: "_count.contacts", label: "Contacts", type: "number" },
      { key: "owner.name", label: "Owner" },
      { key: "createdAt", label: "Created", type: "date" },
    ],
    filters: [],
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
      { name: "ownerUserId", label: "Owner", type: "select", optionsFrom: "users" },
    ],
    searchPlaceholder: "Search name, industry, city…",
  },
  customers: {
    object: "customers",
    title: "Customers",
    singular: "Customer",
    can: { create: "CUSTOMERS_CREATE", edit: "CUSTOMERS_EDIT", delete: "CUSTOMERS_DELETE" },
    columns: [
      { key: "firstName lastName", label: "Name", type: "record", object: "customers" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
      { key: "status.name", label: "Status", type: "badge" },
      { key: "source", label: "Source" },
      { key: "contact.firstName lastName", label: "Linked contact" },
      { key: "owner.name", label: "Owner" },
      { key: "createdAt", label: "Created", type: "date" },
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
    searchPlaceholder: "Search name, email, phone…",
  },
};
