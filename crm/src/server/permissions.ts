/**
 * Centralized RBAC for the CRM module.
 *
 * Permissions are code-level constants; role→permission assignments live in
 * the database (seeded from ROLE_DEFINITIONS here) so operators can extend
 * roles without a deploy. Authorization is enforced server-side via
 * `requirePermission` — never by hiding UI elements.
 */

const CORE_OBJECTS = [
  "LEADS",
  "CONTACTS",
  "ACCOUNTS",
  "CUSTOMERS",
  "OPPORTUNITIES",
  "TASKS",
  "CAMPAIGNS",
] as const;

const CORE_ACTIONS = ["READ", "CREATE", "EDIT", "DELETE", "EXPORT"] as const;

type CorePermission = `${(typeof CORE_OBJECTS)[number]}_${(typeof CORE_ACTIONS)[number]}`;

export type RoleKey =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MANAGER"
  | "TEAM_LEAD"
  | "REP"
  | "VIEWER";

export type Permission =
  | CorePermission
  | "LEADS_IMPORT"
  | "LEADS_ASSIGN"
  | "FILES_READ"
  | "FILES_UPLOAD"
  | "FILES_DELETE"
  | "USERS_MANAGE"
  | "TEAMS_MANAGE"
  | "SETTINGS_MANAGE"
  | "IMPORTS_MANAGE"
  | "AUDIT_VIEW"
  | "REPORTS_VIEW"
  | "DASHBOARDS_VIEW"
  | "ROLES_MANAGE";

export type DataScopeName = "OWN" | "TEAM" | "HIERARCHY" | "ORG";

export const ALL_PERMISSIONS: readonly Permission[] = [
  ...CORE_OBJECTS.flatMap((object) => CORE_ACTIONS.map((action) => `${object}_${action}` as CorePermission)),
  "LEADS_IMPORT",
  "LEADS_ASSIGN",
  "FILES_READ",
  "FILES_UPLOAD",
  "FILES_DELETE",
  "USERS_MANAGE",
  "TEAMS_MANAGE",
  "SETTINGS_MANAGE",
  "IMPORTS_MANAGE",
  "AUDIT_VIEW",
  "REPORTS_VIEW",
  "DASHBOARDS_VIEW",
  "ROLES_MANAGE",
];

const CORE_READ: Permission[] = CORE_OBJECTS.map((object) => `${object}_READ` as CorePermission);
const CORE_WRITE: Permission[] = CORE_OBJECTS.flatMap((object) =>
  ["READ", "CREATE", "EDIT"].map((action) => `${object}_${action}` as CorePermission),
);
const CORE_MANAGE: Permission[] = CORE_OBJECTS.flatMap((object) =>
  ["READ", "CREATE", "EDIT", "DELETE", "EXPORT"].map((action) => `${object}_${action}` as CorePermission),
);

export interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
  scope: DataScopeName;
  permissions: readonly Permission[];
}

/**
 * Superset ordering: SUPER_ADMIN ⊇ ADMIN ⊇ MANAGER ⊇ TEAM_LEAD ⊇ REP ⊇ VIEWER.
 * Row-level visibility narrows by scope: OWN → TEAM → HIERARCHY → ORG.
 */
export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    key: "SUPER_ADMIN",
    name: "Super Admin",
    description: "Full control, including role and permission administration.",
    scope: "ORG",
    permissions: [...ALL_PERMISSIONS],
  },
  {
    key: "ADMIN",
    name: "Admin",
    description: "Manages users, teams, configuration, imports, and audit; cannot edit roles.",
    scope: "ORG",
    permissions: ALL_PERMISSIONS.filter((permission) => permission !== "ROLES_MANAGE"),
  },
  {
    key: "MANAGER",
    name: "Manager",
    description: "Org-wide record management, imports, and reporting.",
    scope: "HIERARCHY",
    permissions: [
      ...CORE_MANAGE,
      "LEADS_IMPORT",
      "LEADS_ASSIGN",
      "FILES_READ",
      "FILES_UPLOAD",
      "FILES_DELETE",
      "IMPORTS_MANAGE",
      "REPORTS_VIEW",
      "DASHBOARDS_VIEW",
    ],
  },
  {
    key: "TEAM_LEAD",
    name: "Team Lead",
    description: "Manages the team's records, assignments, and exports.",
    scope: "TEAM",
    permissions: [
      ...CORE_MANAGE,
      "LEADS_ASSIGN",
      "FILES_READ",
      "FILES_UPLOAD",
      "REPORTS_VIEW",
      "DASHBOARDS_VIEW",
    ],
  },
  {
    key: "REP",
    name: "Rep",
    description: "Works their own records; cannot delete or import.",
    scope: "OWN",
    permissions: [
      ...CORE_WRITE,
      "LEADS_EXPORT",
      "TASKS_EXPORT",
      "FILES_READ",
      "FILES_UPLOAD",
      "REPORTS_VIEW",
      "DASHBOARDS_VIEW",
    ],
  },
  {
    key: "VIEWER",
    name: "Viewer",
    description: "Read-only org-wide access for observers and auditors.",
    scope: "ORG",
    permissions: [...CORE_READ, "FILES_READ", "REPORTS_VIEW", "DASHBOARDS_VIEW"],
  },
];

/** Resolve the full permission set for a role key (used by seed and guard). */
export function permissionsForRoleKey(key: RoleKey): readonly Permission[] {
  const definition = ROLE_DEFINITIONS.find((role) => role.key === key);
  if (!definition) throw new Error(`Unknown role key: ${key}`);
  return definition.permissions;
}
