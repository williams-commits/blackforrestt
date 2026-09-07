/** Centralized CRM RBAC vocabulary and role defaults. */

const CORE_OBJECTS = ["LEADS", "CONTACTS", "ACCOUNTS", "CUSTOMERS", "OPPORTUNITIES"] as const;
type CoreObject = (typeof CORE_OBJECTS)[number];
type CorePermission = `${CoreObject}_${"VIEW" | "CREATE" | "EDIT" | "DELETE" | "ASSIGN" | "EXPORT"}`;

export type RoleKey = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "TEAM_LEAD" | "REP" | "VIEWER";
export type Permission = CorePermission |
  "LEADS_IMPORT" | "LEADS_CONVERT" | "LEADS_CHANGE_STATUS" | "LEADS_MANAGE_TAGS" | "LEADS_CHANGE_POTENTIAL_STATUS" | "LEADS_ADD_NOTE" | "LEADS_CREATE_TASK" | "LEADS_SCHEDULE_APPOINTMENT" |
  "CONTACTS_CHANGE_STATUS" | "CONTACTS_MANAGE_TAGS" | "CONTACTS_ADD_NOTE" | "CONTACTS_CREATE_TASK" | "CONTACTS_SCHEDULE_APPOINTMENT" |
  "ACCOUNTS_CHANGE_STATUS" | "ACCOUNTS_MANAGE_TAGS" | "ACCOUNTS_ADD_NOTE" | "ACCOUNTS_CREATE_TASK" | "ACCOUNTS_SCHEDULE_APPOINTMENT" |
  "CUSTOMERS_CHANGE_STATUS" | "CUSTOMERS_MANAGE_TAGS" | "CUSTOMERS_ADD_NOTE" | "CUSTOMERS_CREATE_TASK" | "CUSTOMERS_SCHEDULE_APPOINTMENT" |
  "OPPORTUNITIES_CHANGE_STATUS" | "OPPORTUNITIES_MANAGE_TAGS" | "OPPORTUNITIES_ADD_NOTE" | "OPPORTUNITIES_CREATE_TASK" | "OPPORTUNITIES_SCHEDULE_APPOINTMENT" |
  "TASKS_VIEW" | "TASKS_CREATE" | "TASKS_EDIT" | "TASKS_DELETE" | "TASKS_ASSIGN" | "TASKS_EXPORT" |
  "APPOINTMENTS_VIEW" | "APPOINTMENTS_CREATE" | "APPOINTMENTS_EDIT" | "APPOINTMENTS_DELETE" | "APPOINTMENTS_ASSIGN" |
  "NOTES_VIEW" | "NOTES_CREATE" | "NOTES_EDIT" | "NOTES_DELETE" |
  "TAGS_VIEW" | "TAGS_CREATE" | "TAGS_EDIT" | "TAGS_DELETE" | "TAGS_ASSIGN" |
  "RECORD_STATUS_VIEW" | "RECORD_STATUS_CREATE" | "RECORD_STATUS_EDIT" | "RECORD_STATUS_DELETE" | "RECORD_STATUS_ASSIGN" |
  "POTENTIAL_STATUS_VIEW" | "POTENTIAL_STATUS_CREATE" | "POTENTIAL_STATUS_EDIT" | "POTENTIAL_STATUS_DELETE" | "POTENTIAL_STATUS_ASSIGN" |
  "IMPORTS_VIEW" | "IMPORTS_CREATE" | "IMPORTS_RUN" | "IMPORTS_RETRY" | "IMPORTS_EXPORT_ERRORS" |
  "REPORTS_VIEW" | "REPORTS_CREATE" | "REPORTS_EDIT" | "REPORTS_DELETE" | "REPORTS_EXPORT" |
  "USERS_VIEW" | "USERS_CREATE" | "USERS_EDIT" | "USERS_SUSPEND" | "USERS_MANAGE_ROLES" |
  "TEAMS_VIEW" | "TEAMS_CREATE" | "TEAMS_EDIT" | "TEAMS_DELETE" | "TEAMS_MANAGE_MEMBERSHIP" |
  "FILES_READ" | "FILES_UPLOAD" | "FILES_DELETE" | "USERS_MANAGE" | "TEAMS_MANAGE" | "SETTINGS_MANAGE" | "IMPORTS_MANAGE" | "AUDIT_VIEW" | "DASHBOARDS_VIEW" | "ROLES_MANAGE" |
  "CAMPAIGNS_VIEW" | "CAMPAIGNS_CREATE" | "CAMPAIGNS_EDIT" | "CAMPAIGNS_DELETE" | "CAMPAIGNS_EXPORT";

export interface PermissionCategory {
  key: string;
  label: string;
  permissions: readonly { key: Permission; label: string }[];
}

const labels = (values: readonly string[]) => values.map((value) => ({
  key: value,
  label: value.replaceAll("_", " ").toLowerCase().replace(/^./, (char) => char.toUpperCase()),
}));
const core = (key: CoreObject, label: string): PermissionCategory => ({
  key,
  label,
  permissions: labels([
    "VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN", "EXPORT",
    ...(key === "LEADS" ? ["IMPORT", "CONVERT"] : []),
    ...(key !== "OPPORTUNITIES" ? ["CHANGE_STATUS"] : []),
    "MANAGE_TAGS", "ADD_NOTE", "CREATE_TASK", "SCHEDULE_APPOINTMENT",
    ...(key === "LEADS" ? ["CHANGE_POTENTIAL_STATUS"] : []),
  ]).map(({ key: action, label: actionLabel }) => ({
    key: `${key}_${action}` as Permission,
    label: actionLabel,
  })),
});
const category = (key: string, label: string, actions: readonly string[]): PermissionCategory => ({
  key,
  label,
  permissions: labels(actions).map(({ key: action, label: actionLabel }) => ({ key: `${key}_${action}` as Permission, label: actionLabel })),
});

export const PERMISSION_CATEGORIES: readonly PermissionCategory[] = [
  ...CORE_OBJECTS.map((object) => core(object, object[0] + object.slice(1).toLowerCase())),
  category("TASKS", "Tasks", ["VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN", "EXPORT"]),
  category("APPOINTMENTS", "Appointments", ["VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN"]),
  category("NOTES", "Notes", ["VIEW", "CREATE", "EDIT", "DELETE"]),
  { key: "TAGS", label: "Tags", permissions: labels(["VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN"]).map(({ key, label }) => ({ key: `TAGS_${key}` as Permission, label: key === "ASSIGN" ? "Assign to Records" : label })) },
  { key: "RECORD_STATUS", label: "Record Statuses", permissions: labels(["VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN"]).map(({ key, label }) => ({ key: `RECORD_STATUS_${key}` as Permission, label: key === "ASSIGN" ? "Assign / Change" : label })) },
  { key: "POTENTIAL_STATUS", label: "Potential Statuses", permissions: labels(["VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN"]).map(({ key, label }) => ({ key: `POTENTIAL_STATUS_${key}` as Permission, label: key === "ASSIGN" ? "Assign / Change" : label })) },
  category("IMPORTS", "Imports", ["VIEW", "CREATE", "RUN", "RETRY", "EXPORT_ERRORS"]),
  category("REPORTS", "Reports", ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT"]),
  category("USERS", "Users", ["VIEW", "CREATE", "EDIT", "SUSPEND", "MANAGE_ROLES"]),
  category("TEAMS", "Teams", ["VIEW", "CREATE", "EDIT", "DELETE", "MANAGE_MEMBERSHIP"]),
  category("CAMPAIGNS", "Campaigns", ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT"]),
  { key: "AUDIT", label: "Audit", permissions: [{ key: "AUDIT_VIEW", label: "View" }] },
  { key: "SETTINGS", label: "Settings", permissions: [{ key: "SETTINGS_MANAGE", label: "Manage" }] },
];

export const ALL_PERMISSIONS: readonly Permission[] = [
  ...PERMISSION_CATEGORIES.flatMap((item) => item.permissions.map(({ key }) => key)),
  "FILES_READ", "FILES_UPLOAD", "FILES_DELETE", "USERS_MANAGE", "TEAMS_MANAGE", "IMPORTS_MANAGE", "DASHBOARDS_VIEW", "ROLES_MANAGE",
  "CAMPAIGNS_CREATE", "CAMPAIGNS_EDIT", "CAMPAIGNS_DELETE", "CAMPAIGNS_EXPORT",
];
const coreManage = CORE_OBJECTS.flatMap((object) => ["VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN", "EXPORT"].map((action) => `${object}_${action}` as CorePermission));
const coreWrite = CORE_OBJECTS.flatMap((object) => ["VIEW", "CREATE", "EDIT"].map((action) => `${object}_${action}` as CorePermission));
const activity: Permission[] = ["LEADS_ADD_NOTE", "LEADS_CREATE_TASK", "LEADS_SCHEDULE_APPOINTMENT", "LEADS_CONVERT"];
const activityCreate: Permission[] = ["TASKS_VIEW", "TASKS_CREATE", "APPOINTMENTS_VIEW", "APPOINTMENTS_CREATE", "NOTES_VIEW", "NOTES_CREATE", "TAGS_VIEW", "TAGS_ASSIGN"];
const activityManage: Permission[] = ["TASKS_VIEW", "TASKS_CREATE", "TASKS_EDIT", "TASKS_DELETE", "TASKS_ASSIGN", "TASKS_EXPORT", "APPOINTMENTS_VIEW", "APPOINTMENTS_CREATE", "APPOINTMENTS_EDIT", "APPOINTMENTS_DELETE", "APPOINTMENTS_ASSIGN", "NOTES_VIEW", "NOTES_CREATE", "NOTES_EDIT", "NOTES_DELETE", "TAGS_VIEW", "TAGS_CREATE", "TAGS_EDIT", "TAGS_DELETE", "TAGS_ASSIGN"];
const leadControls: Permission[] = ["LEADS_CHANGE_STATUS", "LEADS_CHANGE_POTENTIAL_STATUS", "LEADS_MANAGE_TAGS"];

export type DataScopeName = "OWN" | "TEAM" | "HIERARCHY" | "ORG";
export interface RoleDefinition { key: RoleKey; name: string; description: string; scope: DataScopeName; permissions: readonly Permission[]; }
export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  { key: "SUPER_ADMIN", name: "Super Admin", description: "Full control, including role and permission administration.", scope: "ORG", permissions: [...ALL_PERMISSIONS] },
  { key: "ADMIN", name: "Admin", description: "Manages users, teams, configuration, imports, and audit.", scope: "ORG", permissions: ALL_PERMISSIONS.filter((permission) => permission !== "ROLES_MANAGE") },
  { key: "MANAGER", name: "Manager", description: "Org-wide record management, imports, and reporting.", scope: "HIERARCHY", permissions: [...coreManage, ...activity, ...activityManage, ...leadControls, "LEADS_IMPORT", "FILES_READ", "FILES_UPLOAD", "FILES_DELETE", "IMPORTS_MANAGE", "REPORTS_VIEW", "DASHBOARDS_VIEW"] },
  { key: "TEAM_LEAD", name: "Team Lead", description: "Manages the team's records, assignments, and exports.", scope: "TEAM", permissions: [...coreManage, ...activity, ...activityManage, ...leadControls, "FILES_READ", "FILES_UPLOAD", "REPORTS_VIEW", "DASHBOARDS_VIEW"] },
  { key: "REP", name: "Rep", description: "Works their own records; cannot delete or import.", scope: "OWN", permissions: [...coreWrite, ...activity, ...activityCreate, "LEADS_EXPORT", "TASKS_EXPORT", "FILES_READ", "FILES_UPLOAD", "REPORTS_VIEW", "DASHBOARDS_VIEW"] },
  { key: "VIEWER", name: "Viewer", description: "Read-only org-wide access for observers and auditors.", scope: "ORG", permissions: [...CORE_OBJECTS.map((object) => `${object}_VIEW` as CorePermission), "TASKS_VIEW", "APPOINTMENTS_VIEW", "NOTES_VIEW", "TAGS_VIEW", "REPORTS_VIEW", "FILES_READ", "DASHBOARDS_VIEW"] },
];
export function permissionsForRoleKey(key: RoleKey): readonly Permission[] {
  const definition = ROLE_DEFINITIONS.find((role) => role.key === key);
  if (!definition) throw new Error(`Unknown role key: ${key}`);
  return definition.permissions;
}