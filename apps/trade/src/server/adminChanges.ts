import { Prisma, type AdminChangeDomain, type AdminRole } from "@prisma/client";
import { z } from "zod";
import { withSerializableRetry } from "@/server/db";
import { appendAuditEvent, stableJson } from "@/server/ledger";
import {
  leverageMaximumForCategory,
  validateLeveragePolicyConfiguration,
} from "@/server/leverage";
import {
  canReviewChangeDomain,
  permissionsForRoles,
  type AdminRoleName,
} from "@/server/adminPolicy";

const AssignRolePayload = z.object({
  userId: z.string().min(10).max(64),
  role: z.enum(["SUPER_ADMIN", "COMPLIANCE", "FINANCE", "DEALER", "RISK", "SUPPORT", "AUDITOR"]),
  reason: z.string().trim().min(3).max(500),
});
const RevokeRolePayload = AssignRolePayload;
const RiskPayload = z.object({
  code: z.string().trim().min(3).max(80).regex(/^[A-Z0-9_]+$/),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(1000),
  severity: z.enum(["INFO", "WARNING", "BLOCKING"]),
  enabled: z.boolean(),
  configuration: z.record(z.unknown()),
});
const InstrumentPayload = z.object({
  symbol: z.string().trim().min(2).max(32).transform((value) => value.toUpperCase()),
  active: z.boolean(),
  marginPerLot: z.string().regex(/^\d+(?:\.\d{1,8})?$/),
  commissionPerLot: z.string().regex(/^\d+(?:\.\d{1,8})?$/),
  swapLongPips: z.string().regex(/^-?\d+(?:\.\d{1,8})?$/),
  swapShortPips: z.string().regex(/^-?\d+(?:\.\d{1,8})?$/),
  pipSize: z.string().regex(/^\d+(?:\.\d{1,8})?$/).optional(),
  pipValue: z.string().regex(/^\d+(?:\.\d{1,8})?$/).optional(),
  leverageNotionalFactor: z.string().regex(/^\d+(?:\.\d{1,12})?$/).nullable().optional(),
  leverageDefault: z.string().regex(/^\d+(?:\.\d{1,4})?$/).nullable().optional(),
  leverageMax: z.string().regex(/^\d+(?:\.\d{1,4})?$/).nullable().optional(),
});

export const ChangeRequestInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ASSIGN_ROLE"),
    domain: z.literal("ACCESS"),
    entityType: z.literal("User"),
    entityId: z.string().min(10).max(64),
    payload: AssignRolePayload,
  }),
  z.object({
    action: z.literal("REVOKE_ROLE"),
    domain: z.literal("ACCESS"),
    entityType: z.literal("User"),
    entityId: z.string().min(10).max(64),
    payload: RevokeRolePayload,
  }),
  z.object({
    action: z.literal("UPDATE_RISK_RULE"),
    domain: z.literal("RISK"),
    entityType: z.literal("RiskRule"),
    entityId: z.string().trim().min(3).max(80),
    payload: RiskPayload,
  }),
  z.object({
    action: z.literal("UPDATE_INSTRUMENT"),
    domain: z.literal("INSTRUMENT"),
    entityType: z.literal("Instrument"),
    entityId: z.string().trim().min(2).max(32),
    payload: InstrumentPayload,
  }),
]);

export class AdminChangeError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
    this.name = "AdminChangeError";
  }
}


async function loadAdminAuthorization(tx: Prisma.TransactionClient, actorId: string) {
  const user = await tx.user.findUnique({
    where: { id: actorId },
    select: {
      isAdmin: true,
      adminRoles: { where: { revokedAt: null }, select: { role: true } },
    },
  });
  if (!user) throw new AdminChangeError("Administrative actor not found.", 403);
  const roles = (user.isAdmin && user.adminRoles.length === 0
    ? ["SUPER_ADMIN"]
    : user.adminRoles.map((assignment) => assignment.role)) as AdminRoleName[];
  if (roles.length === 0) throw new AdminChangeError("An active administrative role is required.", 403);
  return { roles, permissions: permissionsForRoles(roles) };
}

export async function createAdminChangeRequest(input: {
  actorId: string;
  commandKey: string;
  requestNote?: string;
  change: z.infer<typeof ChangeRequestInput>;
}) {
  const commandKey = input.commandKey.trim();
  const parsedChange = ChangeRequestInput.safeParse(input.change);
  if (!parsedChange.success) throw new AdminChangeError("Invalid administrative change.", 400);
  const change = parsedChange.data;
  if (commandKey.length < 8 || commandKey.length > 160) {
    throw new AdminChangeError("A valid command key is required.", 400);
  }
  if ((change.action === "ASSIGN_ROLE" || change.action === "REVOKE_ROLE") && change.entityId !== change.payload.userId) {
    throw new AdminChangeError("The role-change target does not match the payload user.", 400);
  }
  if (change.action === "UPDATE_RISK_RULE" && change.entityId !== change.payload.code) {
    throw new AdminChangeError("The risk-rule target does not match the payload code.", 400);
  }
  if (change.action === "UPDATE_RISK_RULE" && change.payload.code === "LEVERAGE_POLICY") {
    const error = validateLeveragePolicyConfiguration(change.payload.configuration);
    if (error) throw new AdminChangeError(error, 400);
  }
  if (change.action === "UPDATE_INSTRUMENT" && change.entityId.toUpperCase() !== change.payload.symbol) {
    throw new AdminChangeError("The instrument target does not match the payload symbol.", 400);
  }
  return withSerializableRetry(async (tx) => {
    const actor = await loadAdminAuthorization(tx, input.actorId);
    const requiredPermission = permissionForChangeDomain(change.domain as AdminChangeDomain);
    if (!actor.permissions.includes(requiredPermission)) {
      throw new AdminChangeError(`Forbidden — ${requiredPermission} permission required.`, 403);
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`admin-change:${commandKey}`}))`;
    const existing = await tx.adminChangeRequest.findUnique({ where: { commandKey } });
    if (existing) {
      const sameCommand =
        existing.requestedById === input.actorId &&
        existing.domain === change.domain &&
        existing.action === change.action &&
        existing.entityType === change.entityType &&
        existing.entityId === change.entityId &&
        stableJson(existing.payload) === stableJson(change.payload);
      if (!sameCommand) throw new AdminChangeError("The command key is already in use for a different change.");
      return { request: existing, replayed: true };
    }
    const request = await tx.adminChangeRequest.create({
      data: {
        commandKey,
        domain: change.domain,
        action: change.action,
        entityType: change.entityType,
        entityId: change.entityId,
        payload: change.payload as Prisma.InputJsonValue,
        requestedById: input.actorId,
        requestNote: input.requestNote?.trim() || null,
      },
    });
    await appendAuditEvent(tx, {
      domain: ["RISK", "INSTRUMENT", "CONFIGURATION"].includes(change.domain) ? "CONFIGURATION" : "ADMIN",
      actorId: input.actorId,
      action: "ADMIN_CHANGE_REQUESTED",
      entityType: "AdminChangeRequest",
      entityId: request.id,
      metadata: {
        domain: request.domain,
        action: request.action,
        targetType: request.entityType,
        targetId: request.entityId,
      },
    });
    return { request, replayed: false };
  });
}

async function executeChange(
  tx: Prisma.TransactionClient,
  request: {
    id: string;
    action: string;
    payload: Prisma.JsonValue;
    entityId: string | null;
  },
  reviewerId: string,
) {
  switch (request.action) {
    case "ASSIGN_ROLE": {
      const payload = AssignRolePayload.parse(request.payload);
      const user = await tx.user.findUnique({ where: { id: payload.userId }, select: { id: true } });
      if (!user) throw new AdminChangeError("Target user not found.", 404);
      await tx.adminRoleAssignment.upsert({
        where: { userId_role: { userId: payload.userId, role: payload.role as AdminRole } },
        update: {
          assignedById: reviewerId,
          assignedAt: new Date(),
          revokedById: null,
          revokedAt: null,
          reason: payload.reason,
        },
        create: {
          userId: payload.userId,
          role: payload.role as AdminRole,
          assignedById: reviewerId,
          reason: payload.reason,
        },
      });
      await tx.user.update({ where: { id: payload.userId }, data: { isAdmin: true } });
      break;
    }
    case "REVOKE_ROLE": {
      const payload = RevokeRolePayload.parse(request.payload);
      if (payload.role === "SUPER_ADMIN") {
        const superAdminCount = await tx.adminRoleAssignment.count({ where: { role: "SUPER_ADMIN", revokedAt: null } });
        if (superAdminCount <= 1) throw new AdminChangeError("The final active SUPER_ADMIN role cannot be revoked.", 409);
      }
      const changed = await tx.adminRoleAssignment.updateMany({
        where: { userId: payload.userId, role: payload.role as AdminRole, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: reviewerId, reason: payload.reason },
      });
      if (changed.count !== 1) throw new AdminChangeError("Active role assignment not found.", 404);
      const remaining = await tx.adminRoleAssignment.count({
        where: { userId: payload.userId, revokedAt: null },
      });
      if (remaining === 0) {
        await tx.user.update({ where: { id: payload.userId }, data: { isAdmin: false } });
      }
      break;
    }
    case "UPDATE_RISK_RULE": {
      const payload = RiskPayload.parse(request.payload);
      if (payload.code === "LEVERAGE_POLICY") {
        const error = validateLeveragePolicyConfiguration(payload.configuration);
        if (error) throw new AdminChangeError(error, 400);
        const instrumentOverrides = await tx.instrument.findMany({
          where: { OR: [{ leverageDefault: { not: null } }, { leverageMax: { not: null } }] },
          select: { symbol: true, category: true, leverageDefault: true, leverageMax: true },
        });
        for (const instrument of instrumentOverrides) {
          const classMaximum = leverageMaximumForCategory(payload.configuration, instrument.category);
          if (
            classMaximum &&
            (instrument.leverageDefault?.gt(classMaximum) || instrument.leverageMax?.gt(classMaximum))
          ) {
            throw new AdminChangeError(
              `${instrument.symbol} has an asset leverage override above the proposed ${classMaximum.toString()}x class maximum.`,
              400,
            );
          }
        }
      }
      await tx.riskRule.upsert({
        where: { code: payload.code },
        update: {
          name: payload.name,
          description: payload.description,
          severity: payload.severity,
          enabled: payload.enabled,
          configuration: payload.configuration as Prisma.InputJsonValue,
          version: { increment: 1 },
          updatedById: reviewerId,
        },
        create: {
          code: payload.code,
          name: payload.name,
          description: payload.description,
          severity: payload.severity,
          enabled: payload.enabled,
          configuration: payload.configuration as Prisma.InputJsonValue,
          updatedById: reviewerId,
        },
      });
      break;
    }
    case "UPDATE_INSTRUMENT": {
      const payload = InstrumentPayload.parse(request.payload);
      const instrument = await tx.instrument.findUnique({
        where: { symbol: payload.symbol },
        select: {
          symbol: true,
          pipSize: true,
          pipValue: true,
          category: true,
          leverageNotionalFactor: true,
          leverageDefault: true,
          leverageMax: true,
        },
      });
      if (!instrument) throw new AdminChangeError("Instrument not found.", 404);
      if (
        payload.leverageNotionalFactor !== undefined ||
        payload.leverageDefault !== undefined ||
        payload.leverageMax !== undefined ||
        payload.pipSize !== undefined ||
        payload.pipValue !== undefined
      ) {
        const factor = payload.leverageNotionalFactor === undefined
          ? instrument.leverageNotionalFactor
          : payload.leverageNotionalFactor === null
            ? null
            : new Prisma.Decimal(payload.leverageNotionalFactor);
        const leverageDefault = payload.leverageDefault === undefined
          ? instrument.leverageDefault
          : payload.leverageDefault === null
            ? null
            : new Prisma.Decimal(payload.leverageDefault);
        const leverageMax = payload.leverageMax === undefined
          ? instrument.leverageMax
          : payload.leverageMax === null
            ? null
            : new Prisma.Decimal(payload.leverageMax);
        const pipSize = payload.pipSize === undefined
          ? instrument.pipSize
          : new Prisma.Decimal(payload.pipSize);
        const pipValue = payload.pipValue === undefined
          ? instrument.pipValue
          : new Prisma.Decimal(payload.pipValue);
        if (pipSize.lte(0) || pipValue.lte(0)) {
          throw new AdminChangeError("Pip size and value must be greater than zero.", 400);
        }
        if (factor?.lte(0)) throw new AdminChangeError("A verified notional factor must be greater than zero.", 400);
        if (
          factor &&
          !factor.eq(pipValue.div(pipSize).toDecimalPlaces(12))
        ) {
          throw new AdminChangeError(
            "The verified notional factor must equal pip value divided by pip size so margin and P/L use the same exposure.",
            400,
          );
        }
        if (leverageDefault && (leverageDefault.lt(1) || leverageDefault.gt(500))) {
          throw new AdminChangeError("Asset default leverage must be between 1x and 500x.", 400);
        }
        if (leverageMax && (leverageMax.lt(1) || leverageMax.gt(500))) {
          throw new AdminChangeError("Asset maximum leverage must be between 1x and 500x.", 400);
        }
        if (leverageDefault && leverageMax && leverageDefault.gt(leverageMax)) {
          throw new AdminChangeError("Asset default leverage cannot exceed its maximum.", 400);
        }
        if (!factor && (leverageDefault || leverageMax)) {
          throw new AdminChangeError("Verify the asset notional factor before setting leverage overrides.", 400);
        }
        const classPolicy = await tx.riskRule.findUnique({
          where: { code: "LEVERAGE_POLICY" },
          select: { enabled: true, configuration: true },
        });
        const classMaximum = classPolicy?.enabled
          ? leverageMaximumForCategory(classPolicy.configuration, instrument.category)
          : null;
        if (classMaximum && (leverageMax?.gt(classMaximum) || leverageDefault?.gt(classMaximum))) {
          throw new AdminChangeError(`Asset leverage values cannot exceed the ${classMaximum.toString()}x class maximum.`, 400);
        }
      }
      await tx.instrument.update({
        where: { symbol: payload.symbol },
        data: {
          active: payload.active,
          marginPerLot: payload.marginPerLot,
          commissionPerLot: payload.commissionPerLot,
          swapLongPips: payload.swapLongPips,
          swapShortPips: payload.swapShortPips,
          ...(payload.pipSize !== undefined ? { pipSize: payload.pipSize } : {}),
          ...(payload.pipValue !== undefined ? { pipValue: payload.pipValue } : {}),
          ...(payload.leverageNotionalFactor !== undefined
            ? { leverageNotionalFactor: payload.leverageNotionalFactor }
            : {}),
          ...(payload.leverageDefault !== undefined ? { leverageDefault: payload.leverageDefault } : {}),
          ...(payload.leverageMax !== undefined ? { leverageMax: payload.leverageMax } : {}),
        },
      });
      break;
    }
    default:
      throw new AdminChangeError("Unsupported administrative change.", 400);
  }
}

export async function reviewAdminChangeRequest(input: {
  requestId: string;
  reviewerId: string;
  decision: "APPROVE" | "REJECT";
  note: string;
}) {
  const note = input.note.trim();
  if (note.length < 3 || note.length > 1_000) throw new AdminChangeError("A valid review note is required.", 400);
  return withSerializableRetry(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`admin-change-review:${input.requestId}`}))`;
    const request = await tx.adminChangeRequest.findUnique({ where: { id: input.requestId } });
    if (!request) throw new AdminChangeError("Change request not found.", 404);
    const reviewer = await loadAdminAuthorization(tx, input.reviewerId);
    if (!reviewer.permissions.includes("CHANGE_REQUEST_APPROVE") || !canReviewChangeDomain(reviewer, request.domain)) {
      throw new AdminChangeError(`Forbidden — your roles cannot approve ${request.domain} changes.`, 403);
    }
    if (request.status !== "PENDING") throw new AdminChangeError("Change request is no longer pending.");
    if (request.requestedById === input.reviewerId) {
      throw new AdminChangeError("Maker-checker policy requires a different reviewer.", 403);
    }

    if (input.decision === "REJECT") {
      const rejected = await tx.adminChangeRequest.update({
        where: { id: request.id },
        data: {
          status: "REJECTED",
          reviewedById: input.reviewerId,
          reviewNote: note,
          reviewedAt: new Date(),
        },
      });
      await appendAuditEvent(tx, {
        domain: request.domain === "RISK" || request.domain === "INSTRUMENT" || request.domain === "CONFIGURATION" ? "CONFIGURATION" : "ADMIN",
        actorId: input.reviewerId,
        action: "ADMIN_CHANGE_REJECTED",
        entityType: "AdminChangeRequest",
        entityId: request.id,
        metadata: { domain: request.domain, action: request.action },
      });
      return rejected;
    }

    await executeChange(tx, request, input.reviewerId);
    const approved = await tx.adminChangeRequest.update({
      where: { id: request.id },
      data: {
        status: "EXECUTED",
        reviewedById: input.reviewerId,
        reviewNote: note,
        reviewedAt: new Date(),
        executedAt: new Date(),
      },
    });
    await appendAuditEvent(tx, {
      domain: request.domain === "RISK" || request.domain === "INSTRUMENT" || request.domain === "CONFIGURATION" ? "CONFIGURATION" : "ADMIN",
      actorId: input.reviewerId,
      action: "ADMIN_CHANGE_EXECUTED",
      entityType: "AdminChangeRequest",
      entityId: request.id,
      metadata: {
        domain: request.domain,
        action: request.action,
        targetType: request.entityType,
        targetId: request.entityId,
        makerId: request.requestedById,
      },
    });
    return approved;
  });
}

export function permissionForChangeDomain(domain: AdminChangeDomain): "USER_ACCESS_MANAGE" | "RISK_MANAGE" | "INSTRUMENT_MANAGE" | "CONFIG_MANAGE" {
  switch (domain) {
    case "ACCESS": return "USER_ACCESS_MANAGE";
    case "RISK": return "RISK_MANAGE";
    case "INSTRUMENT": return "INSTRUMENT_MANAGE";
    case "CONFIGURATION": return "CONFIG_MANAGE";
    default: throw new AdminChangeError("Unsupported administrative change domain.", 400);
  }
}
