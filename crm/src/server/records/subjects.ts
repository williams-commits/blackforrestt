import { CrmError } from "@/server/guard";
import type { Permission } from "@/server/permissions";
import type { ScopedContext } from "@/server/records/leads";
import { getLead } from "@/server/records/leads";
import { getContact } from "@/server/records/contacts";
import { getAccount } from "@/server/records/accounts";
import { getCustomer } from "@/server/records/customers";
import { getOpportunity } from "@/server/records/opportunities";

/**
 * Polymorphic subject access. Tasks, notes, and appointments reference
 * records by subjectType/subjectId; every activity write resolves the
 * subject through its (scope-enforcing) service first — an out-of-scope
 * subject yields 404, never a silent write.
 */

export type ActivitySubjectType = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";

export type SubjectAction = "VIEW" | "EDIT" | "ADD_NOTE" | "CREATE_TASK" | "SCHEDULE_APPOINTMENT" | "CHANGE_STATUS" | "MANAGE_TAGS" | "ASSIGN" | "CONVERT";

const SUBJECT_OBJECT: Record<ActivitySubjectType, string> = {
  LEAD: "LEADS",
  CONTACT: "CONTACTS",
  ACCOUNT: "ACCOUNTS",
  CUSTOMER: "CUSTOMERS",
  OPPORTUNITY: "OPPORTUNITIES",
};

/** Resolve the permission for one business action on one subject type. */
export function subjectPermission(subjectType: ActivitySubjectType, action: SubjectAction): Permission {
  const object = SUBJECT_OBJECT[subjectType];
  if (action === "VIEW") return `${object}_VIEW` as Permission;
  if (action === "EDIT") return `${object}_EDIT` as Permission;
  if (action === "ADD_NOTE") return `${object}_ADD_NOTE` as Permission;
  if (action === "CREATE_TASK") return `${object}_CREATE_TASK` as Permission;
  if (action === "SCHEDULE_APPOINTMENT") return `${object}_SCHEDULE_APPOINTMENT` as Permission;
  if (action === "CHANGE_STATUS") return `${object}_CHANGE_STATUS` as Permission;
  if (action === "MANAGE_TAGS") return `${object}_MANAGE_TAGS` as Permission;
  if (action === "ASSIGN") return `${object}_ASSIGN` as Permission;
  return `${object}_CONVERT` as Permission;
}

export interface ResolvedSubject {
  type: ActivitySubjectType;
  id: string;
  label: string;
}

/** Verify the subject exists AND is inside the actor's data scope. */
export async function resolveSubject(
  ctx: ScopedContext,
  subjectType: string,
  subjectId: string,
): Promise<ResolvedSubject> {
  switch (subjectType) {
    case "LEAD": {
      const lead = await getLead(ctx, subjectId);
      return { type: "LEAD", id: subjectId, label: `${lead.firstName} ${lead.lastName}` };
    }
    case "CONTACT": {
      const contact = await getContact(ctx, subjectId);
      return { type: "CONTACT", id: subjectId, label: `${contact.firstName} ${contact.lastName}` };
    }
    case "ACCOUNT": {
      const account = await getAccount(ctx, subjectId);
      return { type: "ACCOUNT", id: subjectId, label: account.name };
    }
    case "CUSTOMER": {
      const customer = await getCustomer(ctx, subjectId);
      return { type: "CUSTOMER", id: subjectId, label: `${customer.firstName} ${customer.lastName}` };
    }
    case "OPPORTUNITY": {
      const opportunity = await getOpportunity(ctx, subjectId);
      return { type: "OPPORTUNITY", id: subjectId, label: opportunity.name };
    }
    default:
      throw new CrmError("Unsupported subject type for activities.", 400);
  }
}
