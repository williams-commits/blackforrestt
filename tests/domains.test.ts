/**
 * Architecture + domain registry gate.
 *
 * Locks in the platform's architectural boundaries so regressions fail CI,
 * not production:
 *
 *  1. REGISTRY INTEGRITY — one explicit config per domain, unique hosts,
 *     every design selection resolvable, default domain first.
 *  2. HOST RESOLUTION — the ONE resolution layer's precedence rules (env
 *     pairs → tradeEnabled → canonical; env overrides → code defaults).
 *  3. BRAND LAYERING — BRAND_OVERRIDES > registry code defaults > primary
 *     env defaults; a domain never renders another domain's identity.
 *  4. IMPORT BOUNDARIES — content has no JSX/i18n imports; registry chain is
 *     dependency-free; no cross-design imports; shared components never
 *     import design trees or domain packages; designs never fetch i18n for
 *     landing copy (the gbfxs tree is the enforced exemplar).
 *
 * Run: npm run test:domains
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  DOMAINS,
  DEFAULT_DOMAIN_KEY,
  brandDomainList,
  brandOverrides,
  domainByKey,
  familyTradeHost,
  resolveHostContext,
  normalizeHost,
  type EnvLike,
} from "../src/platform/registry.js";
import { brandProfileForDomain } from "../src/lib/branding.js";
import { landingDesignKeys } from "../src/designs/registry.js";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const DESIGNS = join(SRC, "designs");

/** Recursively list files under a directory (filtered by extension). */
function walk(dir: string, filter: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, filter));
    else if (filter(entry)) out.push(full);
  }
  return out;
}

const TS_FILES = (dir: string) => walk(dir, (n) => /\.[jt]sx?$/.test(n));

/** Import statements (value vs type) in a TS file's source text. */
function importsOf(source: string): Array<{ raw: string; typeOnly: boolean }> {
  const matches = source.matchAll(/import\s+(type\s+)?[^'"]*?from\s+["']([^"']+)["']/g);
  return [...matches].map((m) => ({ raw: m[2]!, typeOnly: Boolean(m[1]) }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Registry integrity
// ─────────────────────────────────────────────────────────────────────────────

test("registry: one explicit config per domain, keys unique", () => {
  const keys = DOMAINS.map((d) => d.key);
  assert.equal(new Set(keys).size, keys.length, "duplicate domain keys");
  for (const domain of DOMAINS) {
    assert.ok(domain.key.length > 0, "empty key");
    assert.ok(domain.hosts.length > 0, `${domain.key}: no hosts`);
    assert.equal(domainByKey(domain.key).key, domain.key);
  }
});

test("registry: hosts claimed by at most one domain", () => {
  const seen = new Map<string, string>();
  for (const domain of DOMAINS) {
    for (const host of domain.hosts) {
      const normalized = host.toLowerCase();
      const owner = seen.get(normalized);
      assert.equal(owner, undefined, `${normalized} claimed by ${domain.key} AND ${owner}`);
      seen.set(normalized, domain.key);
    }
  }
});

test("registry: first entry is the default domain", () => {
  assert.equal(DOMAINS[0]!.key, DEFAULT_DOMAIN_KEY);
  assert.equal(domainByKey("does-not-exist").key, DEFAULT_DOMAIN_KEY);
});

test("registry: every domain's design selections resolve to a registered design", () => {
  const landing: string[] = [...landingDesignKeys()];
  const publicDesigns: string[] = [...landingDesignKeys()];
  for (const domain of DOMAINS) {
    assert.ok(
      landing.includes(domain.landingDesign),
      `${domain.key}: landingDesign "${domain.landingDesign}" not in registry [${landing}]`,
    );
    assert.ok(
      publicDesigns.includes(domain.publicDesign),
      `${domain.key}: publicDesign "${domain.publicDesign}" not in registry [${publicDesigns}]`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Host resolution precedence
// ─────────────────────────────────────────────────────────────────────────────

const NO_DOMAIN_ENV: EnvLike = {};

test("resolution: falls back to registry hosts when env is unset", () => {
  const list = brandDomainList(NO_DOMAIN_ENV);
  assert.equal(list[0], "blackforrestt.com");
  assert.ok(list.includes("gbfxs.com"));
});

test("resolution: BRAND_DOMAINS env wins and keeps order (canonical first)", () => {
  const list = brandDomainList({ BRAND_DOMAINS: "gbfxs.com, blackforrestt.com ,mirror.example" });
  assert.deepEqual(list, ["gbfxs.com", "blackforrestt.com", "mirror.example"]);
  assert.deepEqual(brandDomainList({ BRAND_DOMAIN: "one.example" }), ["one.example"]);
});

test("resolution: host → domain identity + designs (code defaults)", () => {
  const gbfxs = resolveHostContext("gbfxs.com", NO_DOMAIN_ENV);
  assert.equal(gbfxs.domain.key, "gbfxs");
  assert.equal(gbfxs.landingDesign, "gbfxs");
  assert.equal(gbfxs.publicDesign, "gbfxs");

  const trade = resolveHostContext("trade.gbfxs.com", NO_DOMAIN_ENV);
  assert.equal(trade.domain.key, "gbfxs");
  assert.equal(trade.apex, "gbfxs.com");

  const primary = resolveHostContext("blackforrestt.com", NO_DOMAIN_ENV);
  assert.equal(primary.domain.key, "blackforrest");
  assert.equal(primary.landingDesign, "default");

  // www + port + case normalization
  assert.equal(normalizeHost("WWW.Gbfxs.com:443"), "gbfxs.com");
  assert.equal(normalizeHost("Trade.GBFXS.com"), "trade.gbfxs.com");
  assert.equal(resolveHostContext("www.blackforrestt.com", NO_DOMAIN_ENV).domain.key, "blackforrest");
});

test("resolution: unknown hosts fall back to the default domain", () => {
  const unknown = resolveHostContext("who-knows.example", NO_DOMAIN_ENV);
  assert.equal(unknown.domain.key, DEFAULT_DOMAIN_KEY);
  assert.equal(unknown.landingDesign, "default");
});

test("resolution: env mirror list + BRAND_OVERRIDES design override win over code", () => {
  const env: EnvLike = {
    BRAND_DOMAINS: "blackforrestt.com,gbfxs.com,mirror.example",
    BRAND_OVERRIDES: JSON.stringify({
      "gbfxs.com": { landingTemplate: "default" }, // force primary design on agile host
      "mirror.example": { landingTemplate: "gbfxs" }, // agile design on a mirror
    }),
  };
  assert.equal(resolveHostContext("gbfxs.com", env).landingDesign, "default");
  const mirror = resolveHostContext("mirror.example", env);
  assert.equal(mirror.domain.key, DEFAULT_DOMAIN_KEY); // mirrors → default domain
  assert.equal(mirror.landingDesign, "gbfxs"); // …but env-selected design
  assert.deepEqual(brandOverrides(env)["mirror.example"], { landingTemplate: "gbfxs" });
});

test("resolution: trade host — override > tradeEnabled > canonical (no numbered slots)", () => {
  assert.equal(
    familyTradeHost("gbfxs.com", { BRAND_OVERRIDES: JSON.stringify({ "gbfxs.com": { tradeHost: "app.gbfxs.com" } }) }),
    "app.gbfxs.com",
  );
  // Registry default (gbfxs.tradeEnabled=true) without env:
  assert.equal(familyTradeHost("gbfxs.com", NO_DOMAIN_ENV), "trade.gbfxs.com");
  // Family with no trade host of its own → canonical trade host:
  assert.equal(familyTradeHost("mirror.example", NO_DOMAIN_ENV), "trade.blackforrestt.com");
});

test("resolution: invalid BRAND_OVERRIDES JSON degrades safely", () => {
  assert.deepEqual(brandOverrides({ BRAND_OVERRIDES: "{not json" }), {});
  const ctx = resolveHostContext("gbfxs.com", { BRAND_OVERRIDES: "{not json" });
  assert.equal(ctx.landingDesign, "gbfxs"); // code default survives bad env
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Brand layering + domain isolation
// ─────────────────────────────────────────────────────────────────────────────

test("brand: registry code defaults apply without env (gbfxs names GFX)", () => {
  const profile = brandProfileForDomain("gbfxs.com");
  assert.equal(profile.name, "Global Forex Services");
  assert.equal(profile.landingTemplate, "gbfxs");
  assert.equal(profile.wordmark[0], "Global Forex");
});

test("brand: env overrides beat registry defaults", () => {
  const previous = process.env.BRAND_OVERRIDES;
  try {
    process.env.BRAND_OVERRIDES = JSON.stringify({ "gbfxs.com": { name: "Env Wins Ltd" } });
    const profile = brandProfileForDomain("gbfxs.com");
    assert.equal(profile.name, "Env Wins Ltd");
    assert.equal(profile.legalName, "Global Forex Services Ltd"); // registry default below
  } finally {
    if (previous === undefined) delete process.env.BRAND_OVERRIDES;
    else process.env.BRAND_OVERRIDES = previous;
  }
});

test("brand: primary env defaults flow to the default domain", () => {
  const profile = brandProfileForDomain("blackforrestt.com");
  assert.equal(profile.name, "Black Forest Digital");
  assert.equal(profile.landingTemplate, "default");
});

test("isolation: a registered domain never renders another domain's identity", () => {
  const gbfxs = brandProfileForDomain("gbfxs.com");
  const primary = brandProfileForDomain("blackforrestt.com");
  assert.notEqual(gbfxs.name, primary.name);
  assert.notEqual(gbfxs.supportEmail, primary.supportEmail);
  assert.notEqual(gbfxs.landingTemplate, primary.landingTemplate);
  // The gbfxs wordmark/assets never leak the primary brand:
  assert.ok(!gbfxs.name.includes("Black Forest"));
  assert.ok(!primary.name.includes("Global Forex"));
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Import boundaries (the architectural contract, enforced)
// ─────────────────────────────────────────────────────────────────────────────

test("boundaries: the content library is presentation-free", () => {
  for (const file of TS_FILES(join(SRC, "content"))) {
    const source = readFileSync(file, "utf8");
    assert.ok(!/<\/?[A-Z][A-Za-z]*[\s/>]/.test(source), `${relative(SRC, file)}: JSX in the content layer`);
    for (const imp of importsOf(source)) {
      if (imp.typeOnly) continue;
      assert.fail(`${relative(SRC, file)}: runtime import "${imp.raw}" — content must be pure data`);
    }
  }
});

test("boundaries: the registry chain (registry + domain configs) is dependency-free", () => {
  const chain = [
    join(SRC, "platform/registry.ts"),
    join(SRC, "domains/.generated/domains.ts"),
    ...DOMAINS.flatMap((d) => [join(SRC, `domains/${d.key}/domain.config.ts`)]),
  ];
  for (const file of chain) {
    const source = readFileSync(file, "utf8");
    for (const imp of importsOf(source)) {
      if (imp.typeOnly) continue;
      // registry.ts composes the GENERATED manifest list, which imports the
      // domain configs (pure data); domain configs import nothing at runtime.
      if (file.endsWith("registry.ts") && (imp.raw.includes("domain.config") || imp.raw.includes("generated-domains"))) continue;
      if (file.endsWith(".generated/domains.ts") && imp.raw.includes("domain.config")) continue;
      assert.fail(`${relative(SRC, file)}: runtime import "${imp.raw}" breaks the zero-dependency chain`);
    }
  }
});

test("boundaries: design trees never import each other", () => {
  const gbfxsFiles = TS_FILES(join(DESIGNS, "gbfxs"));
  const blackforestFiles = TS_FILES(join(DESIGNS, "default"));
  for (const file of [...gbfxsFiles, ...blackforestFiles]) {
    const source = readFileSync(file, "utf8");
    for (const imp of importsOf(source)) {
      if (imp.raw.includes("designs/gbfxs") && !file.includes("/gbfxs/")) {
        assert.fail(`${relative(SRC, file)}: imports the gbfxs design tree`);
      }
      if (imp.raw.includes("designs/default") && !file.includes("designs/default")) {
        assert.fail(`${relative(SRC, file)}: imports the blackforest design tree`);
      }
    }
  }
});

test("boundaries: shared components never import design trees or domain packages", () => {
  for (const file of TS_FILES(join(SRC, "components"))) {
    const source = readFileSync(file, "utf8");
    for (const imp of importsOf(source)) {
      assert.ok(
        !imp.raw.includes("landing/") || imp.raw.includes("components/landing"),
        `${relative(SRC, file)}: imports a design tree ("${imp.raw}") — shared components stay generic`,
      );
      assert.ok(!imp.raw.includes("domains/"), `${relative(SRC, file)}: imports a domain package ("${imp.raw}")`);
    }
  }
});

test("boundaries: the gbfxs design consumes contracts, not i18n catalogs", () => {
  for (const file of TS_FILES(join(DESIGNS, "gbfxs"))) {
    const rel = relative(SRC, file);
    const source = readFileSync(file, "utf8");
    assert.ok(
      !source.includes('from "next-intl"') && !source.includes('from "next-intl/server"'),
      `${rel}: fetches translations — content arrives via typed contracts from src/domains/gbfxs/content.ts`,
    );
  }
});

test("boundaries: app routes reach designs only through the dispatchers", () => {
  const dispatchers = new Set([
    "page.tsx",
    "(content)/layout.tsx",
  ]);
  const exceptions = new Set<string>();
  for (const file of TS_FILES(join(SRC, "app"))) {
    const rel = relative(join(SRC, "app"), file);
    if (!rel.endsWith(".tsx") || rel.startsWith("api/")) continue;
    const source = readFileSync(file, "utf8");
    for (const imp of importsOf(source)) {
      const isDesignImport = imp.raw.includes("@/landing/") && !imp.raw.includes("@/platform/composition");
      if (!isDesignImport) continue;
      const allowed = dispatchers.has(rel) || exceptions.has(rel) || imp.raw.includes("landing/designs");
      assert.ok(
        allowed,
        `src/app/${rel}: imports "${imp.raw}" directly — route through the design registry (src/landing/designs.ts)`,
      );
    }
  }
});
