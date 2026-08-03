import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  AdminChangeError,
  createAdminChangeRequest,
  reviewAdminChangeRequest,
} from "../src/server/adminChanges.js";
import { verifyAuditChain } from "../src/server/audit.js";

const prisma = new PrismaClient();

test("administrative role changes are replay-safe and require a different checker", async () => {
  const suffix = randomUUID();
  const [maker, checker, riskReviewer, target] = await Promise.all([
    prisma.user.create({ data: { email: `admin-maker-${suffix}@example.invalid`, accountNo: `m${suffix.replaceAll("-", "").slice(0, 11)}`, isAdmin: true } }),
    prisma.user.create({ data: { email: `admin-checker-${suffix}@example.invalid`, accountNo: `c${suffix.replaceAll("-", "").slice(0, 11)}`, isAdmin: true } }),
    prisma.user.create({ data: { email: `admin-risk-${suffix}@example.invalid`, accountNo: `r${suffix.replaceAll("-", "").slice(0, 11)}`, isAdmin: true } }),
    prisma.user.create({ data: { email: `admin-target-${suffix}@example.invalid`, accountNo: `t${suffix.replaceAll("-", "").slice(0, 11)}` } }),
  ]);
  await prisma.adminRoleAssignment.createMany({
    data: [
      { userId: maker.id, role: "SUPER_ADMIN", assignedById: maker.id, reason: "Integration-test maker" },
      { userId: checker.id, role: "SUPER_ADMIN", assignedById: checker.id, reason: "Integration-test checker" },
      { userId: riskReviewer.id, role: "RISK", assignedById: checker.id, reason: "Integration-test domain reviewer" },
    ],
  });

  const commandKey = `phase6-role-${suffix}`;
  const input = {
    actorId: maker.id,
    commandKey,
    requestNote: "Grant support access for integration verification.",
    change: {
      action: "ASSIGN_ROLE" as const,
      domain: "ACCESS" as const,
      entityType: "User" as const,
      entityId: target.id,
      payload: { userId: target.id, role: "SUPPORT" as const, reason: "Support operations assignment" },
    },
  };
  const created = await createAdminChangeRequest(input);
  assert.equal(created.replayed, false);
  const replay = await createAdminChangeRequest(input);
  assert.equal(replay.replayed, true);
  assert.equal(replay.request.id, created.request.id);

  await assert.rejects(
    reviewAdminChangeRequest({ requestId: created.request.id, reviewerId: maker.id, decision: "APPROVE", note: "Self approval must fail" }),
    (error: unknown) => error instanceof AdminChangeError && error.status === 403,
  );
  await assert.rejects(
    reviewAdminChangeRequest({ requestId: created.request.id, reviewerId: riskReviewer.id, decision: "APPROVE", note: "Risk may not approve access" }),
    (error: unknown) => error instanceof AdminChangeError && error.status === 403,
  );

  const executed = await reviewAdminChangeRequest({
    requestId: created.request.id,
    reviewerId: checker.id,
    decision: "APPROVE",
    note: "Independently reviewed and approved.",
  });
  assert.equal(executed.status, "EXECUTED");
  const assignment = await prisma.adminRoleAssignment.findUniqueOrThrow({
    where: { userId_role: { userId: target.id, role: "SUPPORT" } },
  });
  assert.equal(assignment.revokedAt, null);

  await assert.rejects(
    createAdminChangeRequest({ ...input, change: { ...input.change, payload: { ...input.change.payload, role: "AUDITOR" as const } } }),
    AdminChangeError,
  );

  const chain = await verifyAuditChain();
  assert.equal(chain.valid, true, JSON.stringify(chain.failures));
});

test.after(async () => {
  await prisma.$disconnect();
});
