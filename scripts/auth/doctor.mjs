#!/usr/bin/env node
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { createClient } from "redis";

const checks = [];
const prisma = new PrismaClient();

function add(name, status, detail) {
  checks.push({ name, status, detail });
  const marker = status === "PASS" ? "✓" : status === "WARN" ? "!" : "✗";
  console.log(`${marker} ${name}: ${detail}`);
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function main() {
  const required = ["DATABASE_URL", "AUTH_SECRET", "SECURITY_HASH_PEPPER"];
  for (const name of required) {
    const value = process.env[name]?.trim();
    const configured = Boolean(value && !value.startsWith("change-me"));
    add(`env:${name}`, configured ? "PASS" : "FAIL", configured ? "configured" : value ? "placeholder value must be replaced" : "missing");
  }

  const appOrigin = process.env.APP_ORIGIN?.split(",")[0]?.trim();
  const authUrl = process.env.AUTH_URL?.trim();
  const authUrlValid = Boolean(authUrl && validUrl(authUrl));
  add(
    "env:AUTH_URL",
    authUrlValid ? "PASS" : "FAIL",
    authUrlValid ? authUrl : "set AUTH_URL to the public application origin",
  );
  if (authUrlValid && appOrigin && validUrl(appOrigin)) {
    const matches = new URL(authUrl).origin === new URL(appOrigin).origin;
    add(
      "origin-alignment",
      matches ? "PASS" : "FAIL",
      matches ? "AUTH_URL matches APP_ORIGIN" : `AUTH_URL (${new URL(authUrl).origin}) does not match APP_ORIGIN (${new URL(appOrigin).origin})`,
    );
  } else {
    add("origin-alignment", "FAIL", "APP_ORIGIN and AUTH_URL must both be valid URLs");
  }

  if (process.env.NODE_ENV === "production") {
    add(
      "env:AUTH_TRUST_HOST",
      process.env.AUTH_TRUST_HOST?.toLowerCase() === "true" ? "PASS" : "FAIL",
      process.env.AUTH_TRUST_HOST?.toLowerCase() === "true"
        ? "trusted reverse-proxy host headers enabled"
        : "set AUTH_TRUST_HOST=true only behind a correctly configured trusted proxy",
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    add("database", "PASS", "PostgreSQL is reachable");
    await prisma.securitySession.count();
    add("migration:SecuritySession", "PASS", "table is available");
    await prisma.adminRoleAssignment.count();
    add("migration:AdminRoleAssignment", "PASS", "table is available");
  } catch (error) {
    add("database-or-migrations", "FAIL", error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    add("redis", process.env.NODE_ENV === "production" ? "FAIL" : "WARN", "REDIS_URL is not configured");
  } else {
    const redis = createClient({ url: redisUrl });
    try {
      await redis.connect();
      const pong = await redis.ping();
      add("redis", pong === "PONG" ? "PASS" : "FAIL", pong);
    } catch (error) {
      add(
        "redis",
        process.env.NODE_ENV === "production" ? "FAIL" : "WARN",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      if (redis.isOpen) await redis.quit().catch(() => redis.disconnect());
    }
  }

  const failed = checks.filter((check) => check.status === "FAIL");
  const summary = {
    kind: "authentication_readiness",
    generatedAt: new Date().toISOString(),
    passed: failed.length === 0,
    checks,
  };
  console.log(`\n${JSON.stringify(summary, null, 2)}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
