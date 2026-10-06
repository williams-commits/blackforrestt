#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";

function numberEnv(name, fallback, minimum = 0) {
  const raw = process.env[name];
  const value = raw == null ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`${name} must be a finite number >= ${minimum}.`);
  }
  return value;
}

const baseUrl = new URL(process.env.BASE_URL ?? "http://127.0.0.1:3000");
const paths = (process.env.LOAD_PATHS ?? "/api/health,/api/instruments")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (paths.length === 0) throw new Error("LOAD_PATHS must include at least one path.");

const durationSeconds = numberEnv("LOAD_DURATION_SECONDS", 30, 1);
const concurrency = Math.floor(numberEnv("LOAD_CONCURRENCY", 20, 1));
const requestTimeoutMs = numberEnv("LOAD_REQUEST_TIMEOUT_MS", 5_000, 100);
const maxErrorRate = numberEnv("LOAD_MAX_ERROR_RATE", 0.01, 0);
const maxP95Ms = numberEnv("LOAD_MAX_P95_MS", 750, 1);
const minRequestsPerSecond = numberEnv("LOAD_MIN_RPS", 10, 0);
const sampleLimit = Math.floor(numberEnv("LOAD_LATENCY_SAMPLE_LIMIT", 200_000, 1_000));
const evidenceDir = resolve(process.env.PHASE8_EVIDENCE_DIR ?? "artifacts/phase8");

const startedAt = performance.now();
const deadline = startedAt + durationSeconds * 1_000;
const latencies = [];
const statusCounts = new Map();
let completed = 0;
let failed = 0;
let cursor = 0;

function sampleLatency(value) {
  if (latencies.length < sampleLimit) latencies.push(value);
}

async function worker() {
  while (performance.now() < deadline) {
    const path = paths[cursor++ % paths.length];
    const url = new URL(path, baseUrl);
    const requestStarted = performance.now();
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "blckforest-phase8-load/1.0" },
        signal: AbortSignal.timeout(requestTimeoutMs),
        cache: "no-store",
      });
      await response.arrayBuffer();
      completed += 1;
      sampleLatency(performance.now() - requestStarted);
      statusCounts.set(response.status, (statusCounts.get(response.status) ?? 0) + 1);
      if (!response.ok) failed += 1;
    } catch {
      completed += 1;
      failed += 1;
      sampleLatency(performance.now() - requestStarted);
      statusCounts.set("network_error", (statusCounts.get("network_error") ?? 0) + 1);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
const endedAt = performance.now();
const elapsedSeconds = Math.max((endedAt - startedAt) / 1_000, 0.001);
latencies.sort((a, b) => a - b);
const percentile = (fraction) => {
  if (latencies.length === 0) return null;
  return Number(latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * fraction) - 1)].toFixed(2));
};
const errorRate = completed === 0 ? 1 : failed / completed;
const requestsPerSecond = completed / elapsedSeconds;
const result = {
  kind: "http_load",
  generatedAt: new Date().toISOString(),
  target: baseUrl.origin,
  paths,
  durationSeconds: Number(elapsedSeconds.toFixed(3)),
  concurrency,
  completed,
  failed,
  errorRate: Number(errorRate.toFixed(6)),
  requestsPerSecond: Number(requestsPerSecond.toFixed(2)),
  latencyMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) },
  statuses: Object.fromEntries([...statusCounts.entries()].map(([key, value]) => [String(key), value])),
  thresholds: { maxErrorRate, maxP95Ms, minRequestsPerSecond },
};
const failures = [];
if (errorRate > maxErrorRate) failures.push(`error rate ${errorRate.toFixed(4)} > ${maxErrorRate}`);
if ((result.latencyMs.p95 ?? Infinity) > maxP95Ms) failures.push(`p95 ${result.latencyMs.p95}ms > ${maxP95Ms}ms`);
if (requestsPerSecond < minRequestsPerSecond) failures.push(`throughput ${requestsPerSecond.toFixed(2)}rps < ${minRequestsPerSecond}rps`);
result.passed = failures.length === 0;
result.failures = failures;

await mkdir(evidenceDir, { recursive: true });
await writeFile(resolve(evidenceDir, "http-load.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
