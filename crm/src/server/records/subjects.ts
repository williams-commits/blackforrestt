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

const EDIT_PERMISSION: Record<ActivitySubjectType, Permission> = {
  LEAD: "LEADS_EDIT",
  CONTACT: "CONTACTS_EDIT",
  ACCOUNT: "ACCOUNTS_EDIT",
  CUSTOMER: "CUSTOMERS_EDIT",
  OPPORTUNITY: "OPPORTUNITIES_EDIT",
};

/** Permission required to attach activities to a subject type. */
export function subjectEditPermission(subjectType: ActivitySubjectType): Permission {
  return EDIT_PERMISSION[subjectType];
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
