import type { Permission } from "@/server/permissions";

export type RecordSubjectType = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";

const OBJECT_BY_SUBJECT: Record<RecordSubjectType, string> = {
  LEAD: "LEADS",
  CONTACT: "CONTACTS",
  ACCOUNT: "ACCOUNTS",
  CUSTOMER: "CUSTOMERS",
  OPPORTUNITY: "OPPORTUNITIES",
};

export interface RecordCapabilities {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canAssign: boolean;
  canExport: boolean;
  canChangeStatus: boolean;
  canChangePotentialStatus: boolean;
  canManageTags: boolean;
  canAddNote: boolean;
  canCreateTask: boolean;
  canScheduleAppointment: boolean;
  canConvert: boolean;
}

/** Resolve record actions directly from the matching subject permissions. */
export function getRecordCapabilities(
  subjectType: RecordSubjectType,
  permissions: readonly Permission[] | readonly string[],
): RecordCapabilities {
  const enabled = new Set(permissions);
  const object = OBJECT_BY_SUBJECT[subjectType];
  const has = (action: string) => enabled.has(`${object}_${action}`);
  return {
    canView: has("VIEW"),
    canCreate: has("CREATE"),
    canEdit: has("EDIT"),
    canDelete: has("DELETE"),
    canAssign: has("ASSIGN"),
    canExport: has("EXPORT"),
    canChangeStatus: has("CHANGE_STATUS"),
    canChangePotentialStatus: subjectType === "LEAD" && has("CHANGE_POTENTIAL_STATUS"),
    canManageTags: has("MANAGE_TAGS"),
    canAddNote: has("ADD_NOTE"),
    canCreateTask: has("CREATE_TASK"),
    canScheduleAppointment: has("SCHEDULE_APPOINTMENT"),
    canConvert: subjectType === "LEAD" && has("CONVERT"),
  };
}
