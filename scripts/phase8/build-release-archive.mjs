#!/usr/bin/env node
// Builds a clean source release archive (ZIP) excluding local-only and
// secret-bearing artifacts, mirroring the exclusions enforced by
// verify-release-archive.mjs. The archive is the input that the release
// source scan is designed to validate — never the working directory, which
// legitimately contains a gitignored local `.env`.
//
// Usage:
//   node scripts/phase8/build-release-archive.mjs [sourceRoot] [outZip]
//
// Defaults: sourceRoot = cwd, outZip = artifacts/phase8/blckforest-release.zip
import { execFileSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import process from "node:process";

const sourceRoot = resolve(process.argv[2] ?? process.cwd());
const outZip = resolve(
  process.argv[3] ?? process.env.PHASE8_RELEASE_ARCHIVE ?? "artifacts/phase8/blckforest-release.zip",
);

// Directories that must never ship in a release. Kept in sync with the
// `forbiddenSegments` set in verify-release-archive.mjs plus common local
// state, build output, and editor metadata.
const excludeDirs = [
  "node_modules",
  ".next",
  ".git",
  "coverage",
  "playwright-report",
  "test-results",
  "artifacts",
  "pgdata",
  "redisdata",
  "miniodata",
  "uploads",
  "quarantine",
  "sealed",
  ".turbo",
  ".vercel",
  ".idea",
  ".vscode",
];

// Patterns excluded from the release zip: secret-bearing files, local env,
// and OS/editor detritus. `.env.example` is intentionally kept.
const excludePatterns = [
  ".env",
  ".env.*",
  "!.env.example",
  "*.log",
  ".DS_Store",
  "npm-debug.log*",
  "*.pem",
  "*.p12",
  "*.pfx",
  "*.key",
  "id_rsa",
  "id_ed25519",
  "credentials.json",
];

await mkdir(dirname(outZip), { recursive: true });
await rm(outZip, { force: true });

// Use git to enumerate tracked files when possible: this is the most accurate
// "what would ship" set and naturally respects .gitignore (so the local .env
// is excluded). Fall back to an explicit zip exclude list if not a git repo.
let useGit = true;
try {
  execFileSync("git", ["-C", sourceRoot, "rev-parse", "--is-inside-work-tree"], {
    stdio: "ignore",
    encoding: "utf8",
  });
} catch {
  useGit = false;
}

if (useGit) {
  // "What would ship" = git-tracked files. List every tracked file, then
  // filter in-process for directories/files that must never ship. We avoid
  // git pathspec magic here because it resolves inconsistently under
  // execFileSync; JavaScript filtering is deterministic.
  const allFiles = execFileSync(
    "git",
    ["-C", sourceRoot, "ls-files", "--cached"],
    { encoding: "utf8", maxBuffer: 50_000_000 },
  )
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const files = allFiles.filter((file) => {
    const segments = file.split("/");
    // Drop any file that lives under a forbidden directory.
    if (segments.some((segment) => excludeDirs.includes(segment))) return false;
    const base = segments[segments.length - 1] ?? "";
    // Drop secret-bearing or local-only files even if somehow tracked.
    if (base === ".env") return false;
    if (base.startsWith(".env.") && base !== ".env.example") return false;
    if (base === "id_rsa" || base === "id_ed25519" || base === "credentials.json") return false;
    if (/\.(pem|p12|pfx|key)$/i.test(base)) return false;
    if (base.endsWith(".log") || base === ".DS_Store") return false;
    return true;
  });

  if (files.length === 0) {
    throw new Error("Release archive would be empty: no tracked files found.");
  }

  // Zip with relative paths (no common root prefix), so
  // verify-release-archive.mjs sees paths like "ENTERPRISE_ROADMAP.md".
  // `zip -@` reads the newline-separated file list from stdin; running from
  // sourceRoot keeps the stored paths relative to the repo root.
  const { spawnSync } = await import("node:child_process");
  const zipResult = spawnSync(
    "zip",
    ["-q", "-X", outZip, "-@"],
    { cwd: sourceRoot, input: files.join("\n"), encoding: "utf8" },
  );
  if (zipResult.status !== 0) {
    throw new Error(
      `zip failed (status ${zipResult.status}): ${zipResult.stderr || zipResult.stdout || "no output"}`,
    );
  }
} else {
  // Non-git fallback: zip the tree with explicit excludes.
  const args = ["-q", "-r", "-X", outZip, ".", ...excludeDirs.map((d) => ["-x", `${d}/*`]).flat(), ...excludePatterns.map((p) => ["-x", p]).flat()];
  execFileSync("zip", args, { cwd: sourceRoot, stdio: "ignore", encoding: "utf8" });
}

const { statSync } = await import("node:fs");
const size = statSync(outZip).size;
console.log(
  JSON.stringify(
    { kind: "release_archive_built", path: outZip, bytes: size, method: useGit ? "git-tracked" : "exclude-list" },
    null,
    2,
  ),
);
