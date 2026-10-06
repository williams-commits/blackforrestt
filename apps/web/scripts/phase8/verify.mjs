#!/usr/bin/env node
import { spawn } from "node:child_process";
import { open, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import os from "node:os";

const modeArg = process.argv.find((value) => value.startsWith("--mode="));
const mode = modeArg?.split("=")[1] ?? process.env.PHASE8_MODE ?? "static";
if (!["static", "integration", "full"].includes(mode)) {
  throw new Error("Phase 8 mode must be static, integration, or full.");
}

const evidenceDir = resolve(process.env.PHASE8_EVIDENCE_DIR ?? "artifacts/phase8");
await mkdir(evidenceDir, { recursive: true });
function releaseArchivePath() {
  return process.env.PHASE8_RELEASE_ARCHIVE ?? resolve(evidenceDir, "blckforest-release.zip");
}
const failFast = (process.env.PHASE8_FAIL_FAST ?? "false").toLowerCase() === "true";
const managedServer = mode === "full" && (process.env.PHASE8_START_SERVER ?? "false").toLowerCase() === "true";
const results = [];
let serverProcess = null;
let serverLogHandle = null;

function configuredDependencies() {
  return {
    database: Boolean(process.env.DATABASE_URL),
    databaseAdmin: Boolean(process.env.PHASE8_DATABASE_ADMIN_URL),
    redis: Boolean(process.env.REDIS_URL),
    e2eCredentials: Boolean(process.env.E2E_DEMO_EMAIL && process.env.E2E_DEMO_PASSWORD),
    adminE2eCredentials: Boolean(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD),
    wsAuthentication: Boolean(process.env.WS_COOKIE),
    managedServer,
  };
}

async function writeReport() {
  const failures = results.filter((result) => result.exitCode !== 0);
  const report = {
    kind: "phase8_verification_matrix",
    generatedAt: new Date().toISOString(),
    mode,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      ci: Boolean(process.env.CI),
    },
    configuredDependencies: configuredDependencies(),
    passed: failures.length === 0,
    results,
    failures: failures.map((failure) => failure.name),
  };
  await writeFile(resolve(evidenceDir, "verification-matrix.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n${JSON.stringify(report, null, 2)}`);
  return report;
}

function fullPreflightFailures() {
  if (mode !== "full") return [];
  const required = [
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["PHASE8_DATABASE_ADMIN_URL", process.env.PHASE8_DATABASE_ADMIN_URL],
    ["REDIS_URL", process.env.REDIS_URL],
    ["E2E_DEMO_EMAIL", process.env.E2E_DEMO_EMAIL],
    ["E2E_DEMO_PASSWORD", process.env.E2E_DEMO_PASSWORD],
    ["E2E_ADMIN_EMAIL", process.env.E2E_ADMIN_EMAIL],
    ["E2E_ADMIN_PASSWORD", process.env.E2E_ADMIN_PASSWORD],
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  if (!process.env.WS_COOKIE) {
    missing.push("WS_COOKIE");
  }
  return missing;
}

async function runCommand(name, command, args, extraEnv = {}) {
  const started = Date.now();
  console.log(`\n=== Phase 8: ${name} ===`);
  const exitCode = await new Promise((resolveExit) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
    });
    child.on("error", (error) => {
      console.error(error);
      resolveExit(127);
    });
    child.on("exit", (code, signal) => resolveExit(code ?? (signal ? 128 : 1)));
  });
  const result = {
    name,
    command: [command, ...args],
    exitCode,
    durationMs: Date.now() - started,
  };
  results.push(result);
  return result;
}

async function waitForHttpHealth() {
  const baseUrl = new URL(process.env.BASE_URL ?? process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000");
  const healthUrl = new URL(process.env.PHASE8_HEALTH_PATH ?? "/api/health", baseUrl);
  const timeoutMs = Number(process.env.PHASE8_SERVER_TIMEOUT_MS ?? 120_000);
  const deadline = Date.now() + timeoutMs;
  let lastError = "not attempted";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(3_000), cache: "no-store" });
      if (response.ok) return healthUrl.toString();
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
  }
  throw new Error(`Application did not become healthy at ${healthUrl}: ${lastError}`);
}

async function startManagedServer() {
  const started = Date.now();
  const logPath = resolve(evidenceDir, "application.log");
  serverLogHandle = await open(logPath, "w");
  serverProcess = spawn("npm", ["run", "dev"], {
    env: process.env,
    stdio: ["ignore", serverLogHandle.fd, serverLogHandle.fd],
    detached: process.platform !== "win32",
  });
  serverProcess.on("error", (error) => console.error("Managed application server failed", error));
  try {
    const healthUrl = await waitForHttpHealth();
    results.push({
      name: "runtime-health",
      command: ["npm", "run", "dev"],
      exitCode: 0,
      durationMs: Date.now() - started,
      healthUrl,
      logPath,
    });
  } catch (error) {
    results.push({
      name: "runtime-health",
      command: ["npm", "run", "dev"],
      exitCode: 1,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      logPath,
    });
    throw error;
  }
}

async function stopManagedServer() {
  if (!serverProcess) return;
  const child = serverProcess;
  if (child.exitCode == null && child.signalCode == null) {
    try {
      if (process.platform === "win32") child.kill("SIGTERM");
      else process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
    await Promise.race([
      new Promise((resolveExit) => child.once("exit", resolveExit)),
      new Promise((resolveDelay) => setTimeout(resolveDelay, 10_000)),
    ]);
    if (child.exitCode == null && child.signalCode == null) {
      try {
        if (process.platform === "win32") child.kill("SIGKILL");
        else process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }
  }
  await serverLogHandle?.close().catch(() => undefined);
  serverProcess = null;
  serverLogHandle = null;
}

const missing = fullPreflightFailures();
if (missing.length > 0) {
  results.push({
    name: "full-preflight",
    command: [],
    exitCode: 2,
    durationMs: 0,
    error: `Missing required Phase 8 configuration: ${missing.join(", ")}`,
  });
  const report = await writeReport();
  process.exitCode = report.passed ? 0 : 1;
} else {
  results.push({ name: "full-preflight", command: [], exitCode: 0, durationMs: 0 });

  const prerequisiteCommands = [
    ["phase67-source-contract", "npm", ["run", "phase67:verify:source"]],
    ["db-generate", "npm", ["run", "db:generate"]],
    ["prisma-validate", "npx", ["prisma", "validate"]],
    ["typecheck", "npm", ["run", "typecheck"]],
    ["lint", "npm", ["run", "lint"]],
    ["build", "npm", ["run", "build:clean"]],
    ["unit-suite", "npm", ["run", "test:unit"]],
    ["release-archive-build", "node", ["scripts/phase8/build-release-archive.mjs", ".", releaseArchivePath()]],
    ["release-source-scan", "node", ["scripts/phase8/verify-release-archive.mjs", releaseArchivePath()]],
  ];
  if (mode === "full") {
    prerequisiteCommands.push(["e2e-typecheck", "npm", ["run", "e2e:typecheck"]]);
  }
  if (mode === "integration" || mode === "full") {
    prerequisiteCommands.push(
      ["authentication-readiness", "npm", ["run", "auth:doctor"]],
      ["postgres-integration", "npm", ["run", "test:integration"]],
      ["redis-lease-failover", "node", ["scripts/phase8/redis-failover.mjs"]],
      ["database-matrix", "bash", ["scripts/phase8/database-matrix.sh"]],
    );
  }

  for (const [name, command, args] of prerequisiteCommands) {
    const result = await runCommand(name, command, args);
    if (result.exitCode !== 0 && failFast) break;
  }

  if (mode === "full") {
    const prerequisiteFailed = results.some((result) => result.exitCode !== 0);
    if (prerequisiteFailed) {
      for (const name of ["runtime-health", "playwright", "http-load", "websocket-soak"]) {
        results.push({ name, command: [], exitCode: 78, durationMs: 0, error: "Skipped because a prerequisite gate failed." });
      }
    } else {
      try {
        if (managedServer) await startManagedServer();
        else {
          const started = Date.now();
          const healthUrl = await waitForHttpHealth();
          results.push({ name: "runtime-health", command: [], exitCode: 0, durationMs: Date.now() - started, healthUrl });
        }

        const runtimeCommands = [
          ["playwright", "npm", ["--prefix", "e2e", "test"]],
          ["http-load", "node", ["scripts/phase8/http-load.mjs"]],
          ["websocket-soak", "node", ["scripts/phase8/ws-soak.mjs"]],
        ];
        for (const [name, command, args] of runtimeCommands) {
          const result = await runCommand(name, command, args, { E2E_START_SERVER: "false" });
          if (result.exitCode !== 0 && failFast) break;
        }
      } catch (error) {
        if (!results.some((result) => result.name === "runtime-health" && result.exitCode !== 0)) {
          results.push({
            name: "runtime-health",
            command: [],
            exitCode: 1,
            durationMs: 0,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        await stopManagedServer();
      }
    }
  }

  const report = await writeReport();
  if (!report.passed) process.exitCode = 1;
}
