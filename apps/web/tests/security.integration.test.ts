import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  decryptSensitiveString,
  encryptSensitiveString,
  generateRecoveryCodes,
  generateTotpCode,
  hashNetworkIdentifier,
  hashRecoveryCode,
  hashSecurityToken,
} from "../src/server/security/crypto.js";
import { verifyMfaFactor } from "../src/server/security/mfa.js";
import {
  consumeSecurityToken,
  issueSecurityToken,
} from "../src/server/security/tokens.js";
import {
  createSecuritySession,
  revokeSecuritySession,
  validateSecuritySession,
} from "../src/server/security/sessions.js";
import {
  consumeLoginAttempt,
  LoginThrottledError,
  recordLoginFailure,
} from "../src/server/security/loginThrottle.js";
import { closeRedis } from "../src/server/redis.js";
import { mutationOriginAllowed } from "../src/server/security/origin.js";

const prisma = new PrismaClient();

test("encrypted TOTP and hashed recovery factors are one-time", async () => {
  const suffix = randomUUID();
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  const encrypted = encryptSensitiveString(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptSensitiveString(encrypted), secret);
  const user = await prisma.user.create({
    data: {
      email: `mfa-${suffix}@example.invalid`,
      accountNo: suffix.replaceAll("-", "").slice(0, 12),
      passwordHash: await bcrypt.hash("SecurityTest123", 4),
      emailVerifiedAt: new Date(),
      mfaSecretEncrypted: encrypted,
      mfaEnabledAt: new Date(),
    },
  });
  const code = generateTotpCode(secret);
  const first = await prisma.$transaction((tx) =>
    verifyMfaFactor(tx, {
      userId: user.id,
      encryptedSecret: encrypted,
      code,
    }),
  );
  assert.equal(first, "TOTP");
  const replay = await prisma.$transaction((tx) =>
    verifyMfaFactor(tx, {
      userId: user.id,
      encryptedSecret: encrypted,
      code,
    }),
  );
  assert.equal(replay, null);

  const recoveryCode = generateRecoveryCodes(1)[0];
  await prisma.mfaRecoveryCode.create({
    data: { userId: user.id, codeHash: hashRecoveryCode(recoveryCode) },
  });
  const stored = await prisma.mfaRecoveryCode.findFirstOrThrow({ where: { userId: user.id } });
  assert.notEqual(stored.codeHash, recoveryCode);
  const recovered = await prisma.$transaction((tx) =>
    verifyMfaFactor(tx, {
      userId: user.id,
      encryptedSecret: encrypted,
      code: recoveryCode,
    }),
  );
  assert.equal(recovered, "RECOVERY_CODE");
  const recoveredReplay = await prisma.$transaction((tx) =>
    verifyMfaFactor(tx, {
      userId: user.id,
      encryptedSecret: encrypted,
      code: recoveryCode,
    }),
  );
  assert.equal(recoveredReplay, null);
});

test("verification/reset tokens are hashed, expiring, and single-use", async () => {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `token-${suffix}@example.invalid`,
      accountNo: suffix.replaceAll("-", "").slice(0, 12),
    },
  });
  const issued = await issueSecurityToken({
    userId: user.id,
    type: "EMAIL_VERIFICATION",
  });
  assert.notEqual(issued.record.tokenHash, issued.token);
  assert.equal(issued.record.tokenHash, hashSecurityToken(issued.token));
  const consumed = await consumeSecurityToken({
    token: issued.token,
    type: "EMAIL_VERIFICATION",
    apply: async (tx, record) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      });
      return record.id;
    },
  });
  assert.equal(consumed, issued.record.id);
  const replay = await consumeSecurityToken({
    token: issued.token,
    type: "EMAIL_VERIFICATION",
    apply: async (_tx, record) => record.id,
  });
  assert.equal(replay, null);
});

test("device sessions validate and revoke durably", async () => {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `session-${suffix}@example.invalid`,
      accountNo: suffix.replaceAll("-", "").slice(0, 12),
    },
  });
  const session = await createSecuritySession({
    userId: user.id,
    deviceId: `device-${suffix}`,
    deviceName: "Security integration test",
    userAgent: "node:test",
    networkAddress: "192.0.2.1",
    mfaVerified: true,
  });
  assert.ok(await validateSecuritySession(session.id, user.id));
  assert.equal(
    await revokeSecuritySession({
      actorId: user.id,
      sessionId: session.id,
      reason: "TEST",
    }),
    true,
  );
  assert.equal(await validateSecuritySession(session.id, user.id), null);
});

test("Redis throttle and durable account lockout reject repeated login attempts", async () => {
  const suffix = randomUUID();
  const email = `throttle-${suffix}@example.invalid`;
  const network = `192.0.2.${Math.floor(Math.random() * 200) + 1}-${suffix}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await consumeLoginAttempt(email, network);
  }
  await assert.rejects(consumeLoginAttempt(email, network), LoginThrottledError);

  const user = await prisma.user.create({
    data: {
      email: `lock-${suffix}@example.invalid`,
      accountNo: `l${suffix.replaceAll("-", "").slice(0, 11)}`,
    },
  });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await recordLoginFailure({
      userId: user.id,
      emailHash: hashNetworkIdentifier(email),
      networkHash: hashNetworkIdentifier(network),
    });
  }
  const locked = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(locked.failedLoginCount, 5);
  assert.ok(locked.lockedUntil && locked.lockedUntil > new Date());
});

test("state-changing requests require an allowed same-origin browser context", () => {
  const originalOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://trade.example.test, https://admin.example.test";
  assert.equal(
    mutationOriginAllowed(
      new Request("https://trade.example.test/api/profile", {
        method: "POST",
        headers: {
          Origin: "https://trade.example.test",
          "Sec-Fetch-Site": "same-origin",
        },
      }),
    ),
    true,
  );
  assert.equal(
    mutationOriginAllowed(
      new Request("https://admin.example.test/api/profile", {
        method: "POST",
        headers: {
          Origin: "https://admin.example.test:443",
          "Sec-Fetch-Site": "same-site",
        },
      }),
    ),
    true,
  );
  assert.equal(
    mutationOriginAllowed(
      new Request("https://trade.example.test/api/profile", {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
      }),
    ),
    false,
  );
  assert.equal(
    mutationOriginAllowed(
      new Request("https://trade.example.test/api/profile", { method: "POST" }),
    ),
    false,
  );
  if (originalOrigin == null) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = originalOrigin;
});

test.after(async () => {
  await closeRedis();
  await prisma.$disconnect();
});
