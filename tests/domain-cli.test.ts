/**
 * Domain CLI transactional + deployment acceptance tests.
 *
 * These tests exercise the REAL CLI commands (via the actual script files)
 * to verify:
 *   - create rollback restores ALL generated registries on failure
 *   - registry generate failure exits non-zero through the platform CLI
 *   - deploy-preservation (both directions)
 *   - DEPLOY_DOMAINS scoping
 */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM = join(ROOT, "scripts/platform.mjs");
const GEN = [
  "src/domains/.generated/domains.ts",
  "src/domains/.generated/content.ts",
  "src/designs/.generated/designs.ts",
];

function run(args: string[]) {
  return spawnSync("node", [PLATFORM, ...args], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
}

function snapshotGen(): Record<string, string> {
  return Object.fromEntries(GEN.map((f) => [f, readFileSync(join(ROOT, f), "utf8")]));
}

function snapshotDomainsDir(): string {
  return execFileSync("ls", ["src/domains"], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").sort().join(",");
}

test("registry generate: malformed manifest → platform CLI exits non-zero", () => {
  mkdirSync(join(ROOT, "src/domains/badpkg"), { recursive: true });
  writeFileSync(join(ROOT, "src/domains/badpkg/domain.config.ts"), "export const WRONG = 1;");
  try {
    const result = run(["registry", "generate"]);
    assert.notEqual(result.status, 0, `platform CLI must exit non-zero on generator failure (got ${result.status})`);
  } finally {
    rmSync(join(ROOT, "src/domains/badpkg"), { recursive: true, force: true });
    run(["registry", "generate"]); // restore
  }
});

test("create: failure rolls back ALL generated registries (3 files, not 1)", () => {
  const before = snapshotGen();
  const domainsBefore = snapshotDomainsDir();
  // Force failure: create a domain that will pass staging but FAIL validation
  // (invalid design key — validated against the registry)
  const result = run(["domain", "create", "--key=failtest", "--host=failtest.example", "--design=nonexistent-design"]);
  assert.notEqual(result.status, 0, "create with invalid design must fail");
  const after = snapshotGen();
  const domainsAfter = snapshotDomainsDir();
  // ALL three generated files must be byte-identical to their pre-create state
  for (const [file, content] of Object.entries(before)) {
    assert.equal(after[file], content, `${file} was not restored on rollback`);
  }
  assert.equal(domainsAfter, domainsBefore, "domain directory listing unchanged");
  assert.ok(!existsSync(join(ROOT, "src/domains/failtest")), "failed domain package must not exist");
  assert.ok(!existsSync(join(ROOT, "public/brands/failtest")), "failed domain assets must not exist");
});

test("create: pre-existing brand assets are preserved on rollback", () => {
  const brandsDir = join(ROOT, "public/brands/preexist");
  mkdirSync(brandsDir, { recursive: true });
  writeFileSync(join(brandsDir, "marker.txt"), "pre-existing data");
  try {
    const result = run(["domain", "create", "--key=preexist", "--host=preexist.example", "--design=nonexistent"]);
    assert.notEqual(result.status, 0, "create with invalid design must fail");
    // The pre-existing asset must be PRESERVED (not clobbered by rollback)
    assert.ok(existsSync(join(brandsDir, "marker.txt")), "pre-existing brand asset preserved on rollback");
    assert.equal(readFileSync(join(brandsDir, "marker.txt"), "utf8"), "pre-existing data", "content intact");
  } finally {
    rmSync(brandsDir, { recursive: true, force: true });
  }
});

test("deploy-preservation: deploy gbfxs → blackforrest site file byte-identical", () => {
  const sitesDir = join(ROOT, "deploy/caddy/render/sites");
  const bfFile = join(sitesDir, "blackforrest.caddy");
  if (!existsSync(bfFile)) {
    run(["domain", "deploy", "blackforrest"]); // seed
  }
  const before = readFileSync(bfFile, "utf8");
  const result = run(["domain", "deploy", "gbfxs"]);
  assert.equal(result.status, 0, `deploy gbfxs exit 0 (got ${result.status})`);
  const after = readFileSync(bfFile, "utf8");
  assert.equal(after, before, "blackforrest site file byte-identical after gbfxs deploy");
});

test("deploy-preservation: deploy blackforrest → gbfxs site file byte-identical (symmetric)", () => {
  const sitesDir = join(ROOT, "deploy/caddy/render/sites");
  const gfFile = join(sitesDir, "gbfxs.caddy");
  if (!existsSync(gfFile)) {
    run(["domain", "deploy", "gbfxs"]); // seed
  }
  const before = readFileSync(gfFile, "utf8");
  const result = run(["domain", "deploy", "blackforrest"]);
  assert.equal(result.status, 0);
  const after = readFileSync(gfFile, "utf8");
  assert.equal(after, before, "gbfxs site file byte-identical after blackforrest deploy");
});

test("DEPLOY_DOMAINS scoping: --domains=gbfxs renders only gbfxs site blocks", () => {
  const result = run(["caddy", "render", "--env-file", ".env", "--email", "t@localhost", "--out", "/tmp/scope-test.caddy", "--domains=gbfxs"]);
  assert.equal(result.status, 0);
  const output = readFileSync("/tmp/scope-test.caddy", "utf8");
  assert.ok(output.includes("gbfxs.com {"), "gbfxs routed");
  assert.ok(!output.includes("blackforrestt.com {"), "blackforrestt NOT routed when scoped to gbfxs");
  assert.ok(!output.includes("import app-site") === false, "has at least one site block");
  // Site files on disk are PRESERVED (not deleted)
  assert.ok(existsSync(join(ROOT, "deploy/caddy/render/sites/blackforrest.caddy")), "blackforrest site file preserved on disk");
});

test("DEPLOY_DOMAINS scoping: no scope → all domains", () => {
  const result = run(["caddy", "render", "--env-file", ".env", "--email", "t@localhost", "--out", "/tmp/unscoped-test.caddy"]);
  assert.equal(result.status, 0);
  const output = readFileSync("/tmp/unscoped-test.caddy", "utf8");
  assert.ok(output.includes("gbfxs.com {"), "gbfxs routed");
  assert.ok(output.includes("blackforrestt.com {"), "blackforrestt routed");
});

test("remove: without --confirm refuses (exit 1)", () => {
  // Create a throwaway domain first, then attempt remove without confirm
  run(["domain", "create", "--key=rmtest", "--host=rmtest.example"]);
  try {
    const result = run(["domain", "remove", "rmtest"]);
    assert.equal(result.status, 1, "remove without --confirm must exit 1");
    assert.ok(existsSync(join(ROOT, "src/domains/rmtest")), "domain still exists (refused)");
  } finally {
    run(["domain", "remove", "rmtest", "--confirm"]);
  }
});
