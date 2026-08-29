import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  AdminChangeError,
  createAdminChangeRequest,
  reviewAdminChangeRequest,
} from "../src/server/adminChanges.js";
import {
  AdminUserManagementError,
  adminHardDeleteUser,
  adminSendPasswordReset,
  adminSetTemporaryPassword,
} from "../src/server/adminUserManagement.js";
import {
  ensureSystemAccount,
  ensureUserLedgerAccount,
  money,
  postLedgerTransaction,
  refreshLedgerProjections,
} from "../src/server/ledger.js";
import { consumeSecurityToken } from "../src/server/security/tokens.js";
import { verifyAuditChain } from "../src/server/audit.js";

// Pin email delivery to the development preview path so a developer's local
// .env (real SMTP/HTTP provider) cannot make the reset test attempt a live
// send — the link is returned instead of emailed.
process.env.EMAIL_PROVIDER = "disabled";
process.env.DEV_EMAIL_PREVIEW = "true";

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

test("admin-triggered password reset issues a single-use link and audits the actor", async () => {
  const suffix = randomUUID();
  const tail = suffix.replaceAll("-", "").slice(0, 11);
  const [admin, customer, unverified, deleted] = await Promise.all([
    prisma.user.create({ data: { email: `reset-admin-${suffix}@example.invalid`, accountNo: `a${tail}`, isAdmin: true } }),
    prisma.user.create({ data: { email: `reset-customer-${suffix}@example.invalid`, accountNo: `u${tail}`, emailVerifiedAt: new Date() } }),
    prisma.user.create({ data: { email: `reset-unverified-${suffix}@example.invalid`, accountNo: `v${tail}` } }),
    prisma.user.create({ data: { email: `reset-deleted-${suffix}@example.invalid`, accountNo: `d${tail}`, emailVerifiedAt: new Date(), deletedAt: new Date() } }),
  ]);

  // Preview mode: the single-use link is returned instead of emailed.
  const issued = await adminSendPasswordReset({ actorId: admin.id, userId: customer.id });
  assert.equal(issued.sent, false);
  assert.ok(issued.previewUrl?.includes("/reset-password?token="), issued.previewUrl);
  assert.ok(issued.expiresAt.getTime() > Date.now());

  // The admin action is attributed to the operator, not the target user.
  const auditEvent = await prisma.auditEvent.findFirst({
    where: { action: "PASSWORD_RESET_ADMIN_TRIGGERED", entityType: "User", entityId: customer.id },
    orderBy: { sequence: "desc" },
  });
  assert.ok(auditEvent, "expected an audit event for the admin-triggered reset");
  assert.equal(auditEvent.actorId, admin.id);

  // Guards: unverified email and deleted accounts never receive reset links.
  await assert.rejects(
    adminSendPasswordReset({ actorId: admin.id, userId: unverified.id }),
    (error: unknown) => error instanceof AdminUserManagementError && error.status === 409,
  );
  await assert.rejects(
    adminSendPasswordReset({ actorId: admin.id, userId: deleted.id }),
    (error: unknown) => error instanceof AdminUserManagementError && error.status === 409,
  );

  // The issued token works through the standard confirm flow exactly once —
  // the same consume path the real /reset-password confirmation uses.
  const token = new URL(issued.previewUrl!).searchParams.get("token")!;
  let applied = false;
  const consumed = await consumeSecurityToken({
    token,
    type: "PASSWORD_RESET",
    apply: async () => {
      applied = true;
      return true;
    },
  });
  assert.equal(consumed, true);
  assert.equal(applied, true);
  const replay = await consumeSecurityToken({
    token,
    type: "PASSWORD_RESET",
    apply: async () => true,
  });
  assert.equal(replay, null);

  const chain = await verifyAuditChain();
  assert.equal(chain.valid, true, JSON.stringify(chain.failures));
});

test("admin-generated temporary password becomes the sign-in password and unlocks the account", async () => {
  const suffix = randomUUID();
  const tail = suffix.replaceAll("-", "").slice(0, 11);
  const oldPasswordHash = await bcrypt.hash("OldPass123", 4);
  const [admin, customer] = await Promise.all([
    prisma.user.create({ data: { email: `temp-admin-${suffix}@example.invalid`, accountNo: `a${tail}`, isAdmin: true } }),
    prisma.user.create({
      data: {
        email: `temp-customer-${suffix}@example.invalid`,
        accountNo: `u${tail}`,
        passwordHash: oldPasswordHash,
        failedLoginCount: 5,
        lockedUntil: new Date(Date.now() + 60_000),
      },
    }),
  ]);
  const session = await prisma.securitySession.create({
    data: {
      id: `sess-${suffix}`,
      userId: customer.id,
      deviceId: `dev-${suffix}`,
      deviceName: "Integration test",
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });

  const result = await adminSetTemporaryPassword({ actorId: admin.id, userId: customer.id });
  assert.match(result.temporaryPassword, /^[A-Za-z0-9]{6}$/);

  // The generated code IS the user's password now — old one no longer works.
  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: customer.id },
    select: { passwordHash: true, failedLoginCount: true, lockedUntil: true, passwordChangedAt: true },
  });
  assert.notEqual(updated.passwordHash, oldPasswordHash);
  assert.ok(updated.passwordHash, "expected a password hash after the temporary password was set");
  assert.ok(await bcrypt.compare(result.temporaryPassword, updated.passwordHash));
  assert.ok(!(await bcrypt.compare("OldPass123", updated.passwordHash)));

  // Lockout cleared and every active session revoked — fresh sign-in required.
  assert.equal(updated.failedLoginCount, 0);
  assert.equal(updated.lockedUntil, null);
  assert.ok(updated.passwordChangedAt);
  const revoked = await prisma.securitySession.findUniqueOrThrow({ where: { id: session.id }, select: { revokedAt: true } });
  assert.ok(revoked.revokedAt);

  // Audited under the admin's identity, with zero password material recorded.
  const auditEvent = await prisma.auditEvent.findFirst({
    where: { action: "TEMPORARY_PASSWORD_SET", entityType: "User", entityId: customer.id },
    orderBy: { sequence: "desc" },
  });
  assert.ok(auditEvent, "expected an audit event for the temporary password");
  assert.equal(auditEvent.actorId, admin.id);
  assert.ok(!JSON.stringify(auditEvent.metadata ?? {}).includes(result.temporaryPassword));

  // Deleted accounts are rejected.
  const deleted = await prisma.user.create({
    data: { email: `temp-deleted-${suffix}@example.invalid`, accountNo: `d${tail}`, deletedAt: new Date() },
  });
  await assert.rejects(
    adminSetTemporaryPassword({ actorId: admin.id, userId: deleted.id }),
    (error: unknown) => error instanceof AdminUserManagementError && error.status === 409,
  );

  const chain = await verifyAuditChain();
  assert.equal(chain.valid, true, JSON.stringify(chain.failures));
});

test.after(async () => {
  await prisma.$disconnect();
});

test("hard delete purges zero-activity accounts and refuses financial history", async () => {
  const suffix = randomUUID();
  const actor = await prisma.user.create({
    data: { email: `admin-purge-actor-${suffix}@example.invalid`, accountNo: `p${suffix.replaceAll("-", "").slice(0, 11)}`, isAdmin: true },
  });

  // Signup-shaped dormant user: registration creates LedgerAccount + Wallet +
  // AccountMetrics even with zero activity. Historically these rows made the
  // purge fail with a planner-dependent trigger/FK 500; it must now succeed.
  const dormant = await prisma.user.create({
    data: { email: `purge-dormant-${suffix}@example.invalid`, accountNo: `q${suffix.replaceAll("-", "").slice(0, 11)}`, deletedAt: new Date() },
  });
  await prisma.$transaction(async (tx) => {
    await ensureUserLedgerAccount(tx, dormant.id, "AVAILABLE");
    await refreshLedgerProjections(tx, dormant.id);
  });
  assert.notEqual(await prisma.wallet.findFirst({ where: { userId: dormant.id } }), null, "fixture should have projection rows");

  await adminHardDeleteUser({ actorId: actor.id, userId: dormant.id, reason: "GDPR erasure — dormant account, no activity." });
  assert.equal(await prisma.user.findUnique({ where: { id: dormant.id } }), null, "dormant account should be purged");
  assert.equal(await prisma.ledgerAccount.count({ where: { userId: dormant.id } }), 0, "ledger accounts should be purged");

  // A user with one posted ledger transaction is refused with a friendly 409.
  const active = await prisma.user.create({
    data: { email: `purge-active-${suffix}@example.invalid`, accountNo: `v${suffix.replaceAll("-", "").slice(0, 11)}`, deletedAt: new Date() },
  });
  const [available, funding] = await prisma.$transaction(async (tx) => {
    const account = await ensureUserLedgerAccount(tx, active.id, "AVAILABLE");
    const system = await ensureSystemAccount(tx, "DEMO_FUNDING_EXPENSE");
    return [account, system];
  });
  await prisma.$transaction((tx) =>
    postLedgerTransaction(tx, {
    reference: `PURGE_TEST:${suffix}`,
    kind: "DEMO_FUNDING",
    description: "Integration-test funding that must block erasure",
    userId: active.id,
    sourceType: "User",
    sourceId: active.id,
    lines: [
      { accountId: funding.id, direction: "DEBIT", amount: money("10.00"), asset: "USD" },
      { accountId: available.id, direction: "CREDIT", amount: money("10.00"), asset: "USD" },
    ],
    }),
  );

  await assert.rejects(
    adminHardDeleteUser({ actorId: actor.id, userId: active.id, reason: "GDPR erasure attempt on active account." }),
    (error: unknown) => error instanceof AdminUserManagementError && error.status === 409,
  );
  assert.notEqual(await prisma.user.findUnique({ where: { id: active.id } }), null, "active account must survive");
});
