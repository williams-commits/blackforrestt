#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const leaseMs = Math.max(1_000, Number(process.env.PHASE8_REDIS_LEASE_MS ?? 1_500));
const evidenceDir = resolve(process.env.PHASE8_EVIDENCE_DIR ?? "artifacts/phase8");
const key = `phase8:lease:${randomUUID()}`;
const ownerToken = randomUUID();
const contenderToken = randomUUID();
const releaseScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;
const renewScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
`;

const owner = createClient({ url: redisUrl });
const contender = createClient({ url: redisUrl });
const failures = [];
const observations = {};
try {
  await Promise.all([owner.connect(), contender.connect()]);
  await owner.del(key);
  const [ownerAcquire, contenderAcquire] = await Promise.all([
    owner.set(key, ownerToken, { NX: true, PX: leaseMs }),
    contender.set(key, contenderToken, { NX: true, PX: leaseMs }),
  ]);
  observations.initialAcquire = { ownerAcquire, contenderAcquire };
  if ([ownerAcquire, contenderAcquire].filter((value) => value === "OK").length !== 1) {
    failures.push("exactly one contender must acquire the lease");
  }
  const winnerToken = ownerAcquire === "OK" ? ownerToken : contenderToken;
  const winner = ownerAcquire === "OK" ? owner : contender;
  const loser = ownerAcquire === "OK" ? contender : owner;
  const wrongRelease = await loser.eval(releaseScript, { keys: [key], arguments: [contenderToken === winnerToken ? ownerToken : contenderToken] });
  observations.wrongRelease = Number(wrongRelease);
  if (Number(wrongRelease) !== 0) failures.push("a non-owner released the lease");

  const renewed = await winner.eval(renewScript, { keys: [key], arguments: [winnerToken, String(leaseMs)] });
  observations.renewed = Number(renewed);
  if (Number(renewed) !== 1) failures.push("the owner could not renew the lease");

  await winner.disconnect();
  await new Promise((resolveDelay) => setTimeout(resolveDelay, leaseMs + 250));
  const reacquired = await loser.set(key, randomUUID(), { NX: true, PX: leaseMs });
  observations.reacquiredAfterOwnerLoss = reacquired;
  if (reacquired !== "OK") failures.push("a contender did not acquire after owner loss and TTL expiry");
  await loser.del(key);
} finally {
  if (owner.isOpen) await owner.quit().catch(() => owner.disconnect());
  if (contender.isOpen) await contender.quit().catch(() => contender.disconnect());
}

const result = {
  kind: "redis_lease_failover",
  generatedAt: new Date().toISOString(),
  redisUrl: redisUrl.replace(/:\/\/([^:@/]+):[^@/]+@/, "://$1:<redacted>@"),
  leaseMs,
  observations,
  passed: failures.length === 0,
  failures,
};
await mkdir(evidenceDir, { recursive: true });
await writeFile(resolve(evidenceDir, "redis-failover.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
