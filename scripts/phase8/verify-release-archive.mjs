#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { extname, basename, relative, resolve } from "node:path";
import process from "node:process";

const target = resolve(process.argv[2] ?? ".");
const evidenceDir = resolve(process.env.PHASE8_EVIDENCE_DIR ?? "artifacts/phase8");
const forbiddenSegments = new Set([
  "node_modules", ".next", ".git", "coverage", "playwright-report", "test-results",
  "artifacts", "pgdata", "redisdata", "miniodata", "uploads", "quarantine", "sealed",
]);
const forbiddenNames = [
  /^\.env$/i, /^\.env\.(?!.*example$).+/i, /(^|\.)id_rsa$/i, /(^|\.)id_ed25519$/i,
  /\.pem$/i, /\.p12$/i, /\.pfx$/i, /\.key$/i, /credentials?\.json$/i,
];
const requiredPaths = [
  "ENTERPRISE_ROADMAP.md",
  "ENTERPRISE_PHASE_6.md",
  "VERIFICATION_PHASE_6.md",
  "ENTERPRISE_PHASE_7.md",
  "VERIFICATION_PHASE_7.md",
  "PHASE_6_7_COMPLETION_REPORT.md",
  "ENTERPRISE_PHASE_8.md",
  "VERIFICATION_PHASE_8.md",
  "PHASE8_DELIVERY_VERIFICATION.md",
  ".github/workflows/phase8-verification.yml",
  "scripts/phase67/verify-source.mjs",
  "tests/enterprisePhase67.test.ts",
  "tests/admin.integration.test.ts",
  "scripts/phase8/verify.mjs",
  "scripts/phase8/verify-release-archive.mjs",
  "scripts/phase8/database-matrix.sh",
  "scripts/phase8/http-load.mjs",
  "scripts/phase8/ws-soak.mjs",
  "scripts/phase8/redis-failover.mjs",
  "tests/wsProtocol.test.ts",
  "e2e/playwright.config.ts",
  "e2e/tsconfig.json",
  "docs/runbooks/incident-response.md",
  "docs/runbooks/release-rollback.md",
  "docs/runbooks/backup-restore.md",
  "docs/runbooks/key-rotation.md",
  "docs/runbooks/provider-outage.md",
];
const textExtensions = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".yml", ".yaml", ".md", ".sh", ".prisma", ".env",
]);

function normalize(entry) {
  return entry.replaceAll("\\", "/").replace(/^\.\//, "");
}

async function directoryEntries(root) {
  const entries = [];
  async function walk(directory) {
    for (const name of await readdir(directory)) {
      const absolute = resolve(directory, name);
      const rel = normalize(relative(root, absolute));
      const stat = await lstat(absolute);
      if (stat.isDirectory() && forbiddenSegments.has(name)) continue;
      if (stat.isSymbolicLink()) {
        entries.push({ path: rel, sourcePath: rel, kind: "symlink", size: stat.size });
        continue;
      }
      if (stat.isDirectory()) {
        entries.push({ path: `${rel}/`, sourcePath: `${rel}/`, kind: "directory", size: 0 });
        await walk(absolute);
      } else if (stat.isFile()) {
        entries.push({ path: rel, sourcePath: rel, kind: "file", size: stat.size, absolute });
      }
    }
  }
  await walk(root);
  return entries;
}

function archiveEntries(zipPath) {
  const output = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8", maxBuffer: 20_000_000 });
  return output.split("\n").filter(Boolean).map((sourcePath) => {
    const path = normalize(sourcePath);
    return {
      path,
      sourcePath,
      kind: path.endsWith("/") ? "directory" : "file",
      size: null,
    };
  });
}

function stripCommonRoot(paths) {
  const nonEmpty = paths.filter(Boolean);
  const firstSegments = new Set(nonEmpty.map((path) => path.split("/")[0]));
  if (firstSegments.size !== 1) return paths;
  const root = [...firstSegments][0];
  return paths.map((path) => path === root || path === `${root}/`
    ? ""
    : path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path);
}

function escapeUnzipMember(path) {
  return path.replace(/[\\[\]*?]/g, (character) => `\\${character}`);
}

function isTextPath(path) {
  return textExtensions.has(extname(path).toLowerCase()) || (/^\.env(?:\..+)?\.example$/i.test(basename(path))) || basename(path) === ".env.example";
}

function scanText(path, text, failures, warnings) {
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) {
    failures.push(`private key material detected: ${path}`);
  }
  if (/AKIA[0-9A-Z]{16}/.test(text)) {
    failures.push(`AWS access-key shaped content detected: ${path}`);
  }

  const assignment = /(?:password|secret|token|api[_-]?key)\s*[:=]\s*["']([A-Za-z0-9+/=_-]{24,})["']/gi;
  for (const match of text.matchAll(assignment)) {
    const value = match[1];
    const lower = value.toLowerCase();
    const placeholder = [
      "change-me", "placeholder", "example", "dummy", "use-the-seeded-secret", "replace-me",
    ].some((marker) => lower.includes(marker));
    if (placeholder) continue;
    if (path.startsWith("tests/") || path.startsWith("e2e/tests/")) {
      warnings.push(`credential-shaped deterministic test fixture: ${path}`);
      continue;
    }
    failures.push(`secret-like assignment detected: ${path}`);
  }
}

const targetStat = await lstat(target);
const rawEntries = targetStat.isDirectory() ? await directoryEntries(target) : archiveEntries(target);
const normalizedPaths = stripCommonRoot(rawEntries.map((entry) => entry.path));
const entries = rawEntries.map((entry, index) => ({ ...entry, normalizedPath: normalizedPaths[index] }));
const failures = [];
const warnings = [];
for (const entry of entries) {
  const path = entry.normalizedPath;
  if (!path) continue;
  if (path.startsWith("/") || /^[A-Za-z]:\//.test(path) || path.split("/").includes("..")) {
    failures.push(`unsafe archive path: ${path}`);
  }
  const parts = path.split("/").filter(Boolean);
  if (parts.some((part) => forbiddenSegments.has(part))) failures.push(`forbidden release path: ${path}`);
  if (forbiddenNames.some((pattern) => pattern.test(basename(path)))) failures.push(`secret-like file name: ${path}`);
  if (entry.kind === "symlink") warnings.push(`symlink requires manual review: ${path}`);
}
const pathSet = new Set(entries.map((entry) => entry.normalizedPath));
for (const required of requiredPaths) {
  if (!pathSet.has(required)) failures.push(`required Phase 8 evidence missing: ${required}`);
}

let secretScanFiles = 0;
for (const entry of entries) {
  if (entry.kind !== "file" || !isTextPath(entry.normalizedPath)) continue;
  if (entry.size != null && entry.size > 1_000_000) {
    warnings.push(`large text file skipped by secret scanner: ${entry.normalizedPath}`);
    continue;
  }
  let text = null;
  if (targetStat.isDirectory() && entry.absolute) {
    text = await readFile(entry.absolute, "utf8").catch(() => null);
  } else if (targetStat.isFile()) {
    try {
      text = execFileSync("unzip", ["-p", target, escapeUnzipMember(entry.sourcePath)], {
        encoding: "utf8",
        maxBuffer: 1_100_000,
      });
    } catch {
      warnings.push(`archive text could not be scanned: ${entry.normalizedPath}`);
    }
  }
  if (text == null) continue;
  secretScanFiles += 1;
  scanText(entry.normalizedPath, text, failures, warnings);
}

let sha256 = null;
if (targetStat.isFile()) {
  sha256 = createHash("sha256").update(await readFile(target)).digest("hex");
}
const result = {
  kind: "release_archive_verification",
  generatedAt: new Date().toISOString(),
  target,
  targetType: targetStat.isDirectory() ? "directory" : "archive",
  entryCount: entries.length,
  secretScanFiles,
  sha256,
  passed: failures.length === 0,
  failures: [...new Set(failures)],
  warnings: [...new Set(warnings)],
};
await mkdir(evidenceDir, { recursive: true });
await writeFile(resolve(evidenceDir, "release-archive.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
