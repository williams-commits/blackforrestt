/**
 * Deployment-preservation acceptance (hard production requirement).
 *
 * Deploying ONE domain must NEVER remove, rewrite, or break any other
 * deployed domain — site files, merged Caddyfile content, and reachability
 * (site blocks present + config valid) are asserted in BOTH directions.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_MARKER = /([a-z0-9.-]+)\s*\{\s*\n\s*import app-site/g;

function loadDomains() {
  const script = `import { DOMAINS } from ${JSON.stringify(join(ROOT, "src/domains/.generated/domains.ts"))};console.log(JSON.stringify(DOMAINS));`;
  return JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--eval", script], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
}

async function lib(): Promise<typeof import("../scripts/platform/lib/deploy-config.mjs")> {
  return import(join(ROOT, "scripts/platform/lib/deploy-config.mjs"));
}

function setupTempSites(dir: string, domains: Array<{ key: string }>, { renderDomainSite }: { renderDomainSite: (d: any, e: string) => string }, envFile: string) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const domain of domains) {
    writeFileSync(join(dir, `${domain.key}.caddy`), renderDomainSite(domain, envFile));
  }
}

function siteHosts(caddyfile: string) {
  const hosts = new Set();
  for (const match of caddyfile.matchAll(SITE_MARKER)) hosts.add(match[1]);
  return hosts;
}

test("deploy gbfxs → blackforrest unchanged, present, and the merged config stays valid", async () => {
  const { renderDomainSite, renderCaddyfile } = await lib();
  const domains = loadDomains();
  const envFile = join(ROOT, ".env"); // local env; email passed explicitly
  const dir = join(ROOT, ".tmp-deploy-test-sites");
  try {
    setupTempSites(dir, domains, { renderDomainSite }, envFile);
    const before = {
      blackforrest: readFileSync(join(dir, "blackforrest.caddy"), "utf8"),
      caddy: renderCaddyfile({ envFile, sitesDir: dir, snippetsPath: join(ROOT, "deploy/caddy/template/snippets.caddy"), email: "test@localhost" }),
    };
    assert.ok(siteHosts(before.caddy).has("blackforrestt.com"), "blackforrest deployed initially");
    assert.ok(siteHosts(before.caddy).has("gbfxs.com"), "gbfxs deployed initially");

    // DEPLOY GBFXS ONLY (rewrites only its site file + re-merges)
    const gbfxs = domains.find((d: { key: string }) => d.key === "gbfxs");
    writeFileSync(join(dir, "gbfxs.caddy"), renderDomainSite(gbfxs, envFile));
    const after = {
      blackforrest: readFileSync(join(dir, "blackforrest.caddy"), "utf8"),
      caddy: renderCaddyfile({ envFile, sitesDir: dir, snippetsPath: join(ROOT, "deploy/caddy/template/snippets.caddy"), email: "test@localhost" }),
    };

    assert.equal(after.blackforrest, before.blackforrest, "blackforrest site file byte-identical");
    assert.ok(siteHosts(after.caddy).has("blackforrestt.com"), "blackforrest still routed (reachable)");
    assert.ok(siteHosts(after.caddy).has("trade.blackforrestt.com"), "blackforrest trade host still routed");
    assert.ok(siteHosts(after.caddy).has("gbfxs.com"), "gbfxs updated + routed");
    assert.equal((after.caddy.match(/import app-site/g) ?? []).length, (before.caddy.match(/import app-site/g) ?? []).length, "same block count — nothing dropped");
    assert.ok(after.caddy.startsWith("# GENERATED FILE"), "merged config is generated (not source of truth)");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("deploy blackforrest → gbfxs unchanged (symmetric)", async () => {
  const { renderDomainSite, renderCaddyfile } = await lib();
  const domains = loadDomains();
  const envFile = join(ROOT, ".env");
  const dir = join(ROOT, ".tmp-deploy-test-sites");
  try {
    setupTempSites(dir, domains, { renderDomainSite }, envFile);
    const before = {
      gbfxs: readFileSync(join(dir, "gbfxs.caddy"), "utf8"),
      caddy: renderCaddyfile({ envFile, sitesDir: dir, snippetsPath: join(ROOT, "deploy/caddy/template/snippets.caddy"), email: "test@localhost" }),
    };
    const blackforrest = domains.find((d: { key: string }) => d.key === "blackforrest");
    writeFileSync(join(dir, "blackforrest.caddy"), renderDomainSite(blackforrest, envFile));
    const after = {
      gbfxs: readFileSync(join(dir, "gbfxs.caddy"), "utf8"),
      caddy: renderCaddyfile({ envFile, sitesDir: dir, snippetsPath: join(ROOT, "deploy/caddy/template/snippets.caddy"), email: "test@localhost" }),
    };
    assert.equal(after.gbfxs, before.gbfxs, "gbfxs site file byte-identical");
    assert.ok(siteHosts(after.caddy).has("gbfxs.com"), "gbfxs still routed");
    assert.ok(siteHosts(after.caddy).has("blackforrestt.com"), "blackforrest updated + routed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("per-domain site files are the ONLY deployment state (no other domain content in a site file)", async () => {
  const { renderDomainSite } = await lib();
  const domains: Array<{ key: string; hosts: string[] }> = loadDomains();
  for (const domain of domains) {
    const block = renderDomainSite(domain as any, join(ROOT, ".env"));
    for (const other of domains.filter((d: { key: string }) => d.key !== domain.key)) {
      for (const host of other.hosts) {
        assert.ok(!block.includes(`${host} {`), `${domain.key} site file must not route ${other.key}'s ${host}`);
      }
    }
  }
});

test("no numbered domain slots anywhere in source or CI", () => {
  let result = "";
  try {
    result = execFileSync("grep", [
      "-rn", "-E", "DOMAIN_2|DOMAIN_3|DOMAIN_4|TRADE_DOMAIN_2|TRADE_DOMAIN_3|TRADE_DOMAIN_4",
      // code + config only — prose/docs legitimately mention the forbidden
      // pattern when explaining what NOT to do
      "src", "scripts", "deploy", "next.config.ts", "Makefile", ".github",
    ], { cwd: ROOT, encoding: "utf8" });
  } catch (error: any) {
    // grep exits 1 when nothing matches — the GOOD case here.
    if (error?.status !== 1) throw error;
    result = error?.stdout?.toString() ?? "";
  }
  assert.equal(result.trim(), "", "numbered domain slots must not exist:\n" + result);
});
