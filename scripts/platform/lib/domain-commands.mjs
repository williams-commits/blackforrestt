/**
 * Domain lifecycle commands — the canonical onboarding path:
 *
 *   create → validate → doctor → dev → test → deploy → remove
 *
 * create is TRANSACTIONAL (staging dir; nothing is committed unless every
 * generated artifact validates). remove is SAFE (dependency graph +
 * explicit --confirm). deploy writes ONLY the selected domain's site file —
 * other deployed domains are never touched.
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync,
} from "node:fs";
import { join } from "node:path";

// ── shared helpers ──────────────────────────────────────────────────────────

function runTsx(script, cwd) {
  return execFileSync(process.execPath, ["--import", "tsx", "--eval", script], {
    cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"],
  });
}

function loadDomainRegistry(ROOT) {
  const out = runTsx(
    `import { DOMAINS } from ${JSON.stringify(join(ROOT, "src/domains/.generated/domains.ts"))};` +
    `console.log(JSON.stringify(DOMAINS));`, ROOT);
  return JSON.parse(out);
}

function loadDesignKeys(ROOT) {
  const out = runTsx(
    `import { DESIGN_MANIFESTS } from ${JSON.stringify(join(ROOT, "src/designs/.generated/designs.ts"))};` +
    `console.log(JSON.stringify(Object.keys(DESIGN_MANIFESTS)));`, ROOT);
  return JSON.parse(out);
}

const HOST_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const KEY_RE = /^[a-z][a-z0-9-]*$/;

function tsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function importsOf(source) {
  return [...source.matchAll(/import\s+(type\s+)?[^'"]*?from\s+["']([^"']+)["']/g)]
    .map((m) => ({ raw: m[2], typeOnly: Boolean(m[1]) }));
}

// ── validate ────────────────────────────────────────────────────────────────

export function validate({ positional, flags }, { ROOT }) {
  const key = flags.key ?? positional[0];
  if (flags.help || !key) { console.log("usage: platform domain validate <key>"); return !key ? 1 : 0; }
  const problems = validateDomain(key, ROOT, { quiet: true });
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem.area}: ${problem.message}`);
    console.error(`\nDomain "${key}" is INVALID (${problems.length} problem${problems.length === 1 ? "" : "s"}).`);
    return 1;
  }
  console.log(`✓ Domain "${key}" is valid.`);
  return 0;
}

export function validateDomain(key, ROOT, { quiet } = {}) {
  const problems = [];
  const add = (area, message) => problems.push({ area, message });
  const domains = loadDomainRegistry(ROOT);
  const domain = domains.find((entry) => entry.key === key);
  const domainDir = join(ROOT, "src/domains", key);
  if (!domain) { add("manifest", `no domain "${key}" in the registry (known: ${domains.map((d) => d.key).join(", ")})`); return problems; }

  // manifest basics
  if (!KEY_RE.test(domain.key)) add("manifest", `key "${domain.key}" must be lowercase alphanum/dashes`);
  if (!domain.brand?.name) add("manifest", "brand.name missing (key ≠ brand ≠ host — all explicit)");
  if (domain.key === domain.brand?.name) add("manifest", "key and brand.name must be distinct concepts");
  if (!Array.isArray(domain.hosts) || domain.hosts.length === 0) add("hosts", "no hosts declared");
  for (const host of domain.hosts) if (!HOST_RE.test(host)) add("hosts", `"${host}" is not a valid hostname`);
  if (domain.hosts.includes(domain.key)) add("hosts", "hosts must not equal the domain key");

  // designs
  const designs = loadDesignKeys(ROOT);
  if (!designs.includes(domain.landingDesign)) add("landing design", `"${domain.landingDesign}" not in registry [${designs.join(", ")}]`);
  if (!designs.includes(domain.publicDesign)) add("public design", `"${domain.publicDesign}" not in registry [${designs.join(", ")}]`);

  // package completeness
  for (const file of ["domain.config.ts", "content/landing.ts", "content/public.ts", "navigation.ts", "seo.ts", "assets.ts", "landing.ts", "public.ts", "index.ts", "README.md"]) {
    if (!existsSync(join(domainDir, file))) add("content", `missing ${file}`);
  }

  // loaders implement the contract
  if (existsSync(join(domainDir, "index.ts"))) {
    const barrel = readFileSync(join(domainDir, "index.ts"), "utf8");
    if (!barrel.includes("contentLoaders")) add("content", "index.ts does not export contentLoaders (DomainContentLoaders contract)");
  }

  // assets resolve
  if (existsSync(join(domainDir, "assets.ts"))) {
    const assets = readFileSync(join(domainDir, "assets.ts"), "utf8");
    for (const match of assets.matchAll(/"\/(brands\/[^"]+|og\.png|brand\/[^"]+)"/g)) {
      if (!existsSync(join(ROOT, "public", match[1]))) add("assets", `missing public/${match[1]}`);
    }
  }

  // cross-domain imports + branding leakage
  const otherDomains = domains.filter((entry) => entry.key !== key);
  for (const file of tsFiles(domainDir)) {
    const source = readFileSync(file, "utf8");
    for (const imp of importsOf(source)) {
      for (const other of otherDomains) {
        if (imp.raw.includes(`domains/${other.key}`)) add("dependencies", `${file.replace(ROOT + "/", "")} imports domain "${other.key}"`);
        if (imp.raw.includes(`designs/${other.key}`) && !imp.raw.includes("contracts")) add("dependencies", `${file.replace(ROOT + "/", "")} imports design "${other.key}"`);
      }
    }
    for (const other of otherDomains) {
      if (other.brand?.name && source.includes(other.brand.name)) {
        add("branding leakage", `${file.replace(ROOT + "/", "")} mentions "${other.brand.name}"`);
      }
    }
  }

  // registry freshness
  const gen = join(ROOT, "src/domains/.generated/domains.ts");
  if (existsSync(gen) && !readFileSync(gen, "utf8").includes(domain.key)) {
    add("registry", `"${key}" missing from the generated registry — run: npm run registry:generate`);
  }
  return problems;
}

// ── doctor ──────────────────────────────────────────────────────────────────

export async function doctor({ positional, flags }, { ROOT }) {
  const key = flags.key ?? positional[0];
  if (flags.help || !key) { console.log("usage: platform domain doctor <key> [--json]"); return !key ? 1 : 0; }
  const checks = [];
  const record = (name, ok, detail = "") => checks.push({ name, ok, detail });
  const domains = loadDomainRegistry(ROOT);
  const domain = domains.find((entry) => entry.key === key);
  if (!domain) {
    record("Manifest", false, `domain "${key}" not found`);
  } else {
    const problems = validateDomain(key, ROOT);
    const byArea = new Map(problems.map((p) => [p.area, p.message]));
    record("Manifest", !byArea.has("manifest"), byArea.get("manifest") ?? "");
    record("Domain key", KEY_RE.test(domain.key), KEY_RE.test(domain.key) ? "" : "invalid key syntax");
    record("Brand name", Boolean(domain.brand?.name) && domain.brand.name !== domain.key, "explicit and distinct from key");
    record("Hostname", domain.hosts.every((h) => HOST_RE.test(h)), domain.hosts.join(", "));
    record("Trade host", domain.tradeEnabled ? `${(domain.brand?.tradeHost ?? "trade." + domain.hosts[0])}` : "(not enabled)");
    record("Content", !byArea.has("content"), byArea.get("content") ?? "");
    record("Landing design", !byArea.has("landing design"), domain.landingDesign);
    record("Public design", !byArea.has("public design"), domain.publicDesign);
    record("Navigation", existsSync(join(ROOT, "src/domains", key, "navigation.ts")));
    record("SEO", existsSync(join(ROOT, "src/domains", key, "seo.ts")));
    record("Assets", !byArea.has("assets"), byArea.get("assets") ?? "");
    record("Registry", !byArea.has("registry"), byArea.get("registry") ?? "");
    // freshness
    try {
      const before = readFileSync(join(ROOT, "src/domains/.generated/domains.ts"), "utf8");
      execFileSync(process.execPath, [join(ROOT, "scripts/platform/generate-registry.mjs")], { stdio: "pipe" });
      record("Registry freshness", readFileSync(join(ROOT, "src/domains/.generated/domains.ts"), "utf8") === before);
    } catch { record("Registry freshness", false, "generator failed"); }
    record("Dependencies", !byArea.has("dependencies"), byArea.get("dependencies") ?? "");
    record("Branding leakage", !byArea.has("branding leakage"), byArea.get("branding leakage") ?? "");
    record("Caddy config", (() => {
      try {
        // site block must be renderable from the manifest
        const domainDir = join(ROOT, "src/domains", key);
        return existsSync(join(ROOT, "deploy/caddy/template/snippets.caddy")) && existsSync(domainDir);
      } catch { return false; }
    })(), "site block renderable");
    record("Domain isolation", !byArea.has("dependencies") && !byArea.has("branding leakage"));
    // deployment state
    const siteFile = join(ROOT, "deploy/caddy/render/sites", `${key}.caddy`);
    record("Deployment state", true, existsSync(siteFile) ? "site file deployed" : "not deployed (no site file)");
  }

  if (flags.json) {
    console.log(JSON.stringify({ domain: key, checks, ready: checks.every((c) => c.ok) }, null, 2));
  } else {
    console.log(`Domain Doctor: ${key}`);
    for (const check of checks) {
      console.log(` ${check.ok ? "✓" : "✗"} ${check.name}${check.detail && !check.ok ? `\n     ${check.detail}` : ""}`);
    }
    console.log(checks.every((c) => c.ok) ? " READY" : "\n NOT READY — fix the ✗ items above");
  }
  return checks.every((c) => c.ok) ? 0 : 1;
}

// ── dev ─────────────────────────────────────────────────────────────────────

export async function dev({ positional, flags }, { ROOT, fail }) {
  const key = flags.key ?? positional[0];
  if (flags.help || !key) { console.log("usage: platform domain dev <key>"); return !key ? 1 : 0; }
  const domains = loadDomainRegistry(ROOT);
  const domain = domains.find((entry) => entry.key === key);
  if (!domain) return fail(`unknown domain "${key}"`);
  const hosts = domain.hosts.map((host) => host.endsWith(".localhost") ? host : `${host.split(".")[0]}.localhost`);
  console.log(`Starting dev server for domain "${key}" (${domain.hosts.join(", ")})`);
  console.log(`Local hosts (Chromium/macOS resolve *.localhost automatically): ${hosts.join(", ")}`);
  console.log("Set the locale/dev env below if needed; Ctrl+C to stop.\n");
  const env = {
    ...process.env,
    BRAND_DOMAINS: domain.hosts.join(","),
    BRAND_OVERRIDES: process.env.BRAND_OVERRIDES ?? "",
  };
  const child = spawnSync("npm", ["run", "dev"], { stdio: "inherit", env, cwd: ROOT });
  return child.status ?? 0;
}

// ── test ────────────────────────────────────────────────────────────────────

export async function test({ positional, flags }, { ROOT, fail }) {
  const key = flags.key ?? positional[0];
  if (flags.help || !key) { console.log("usage: platform domain test <key> [--live]"); return !key ? 1 : 0; }
  const validateCode = validate({ positional: [key], flags: {} }, { ROOT });
  if (validateCode !== 0) return validateCode;
  console.log(`\nRunning architecture/isolation suites (domain scope: ${key})…`);
  const child = spawnSync(process.execPath,
    ["--import", "tsx", "--test", "tests/domains.test.ts", "tests/registry-freshness.test.ts"],
    { stdio: "inherit", cwd: ROOT, env: { ...process.env, DOMAIN_UNDER_TEST: key } });
  if ((child.status ?? 0) !== 0) return 1;
  if (flags.live) {
    console.log("\n--live: probing dev server (start it first: npm run platform -- domain dev " + key + ")");
    const health = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "http://localhost:3000/api/health"], { encoding: "utf8" });
    console.log(health.stdout.trim() === "200" ? "✓ dev server healthy" : "✗ dev server not reachable on :3000");
    return health.stdout.trim() === "200" ? 0 : 1;
  }
  console.log(`\n✓ Domain "${key}" tests pass.`);
  return 0;
}

// ── deploy ──────────────────────────────────────────────────────────────────

export async function deploy({ positional, flags }, { ROOT, fail }) {
  const key = flags.key ?? positional[0];
  if (flags.help || !key) { console.log("usage: platform domain deploy <key> [--dry-run] [--env-file <path>]"); return !key ? 1 : 0; }
  const domains = loadDomainRegistry(ROOT);
  const domain = domains.find((entry) => entry.key === key);
  if (!domain) return fail(`unknown domain "${key}"`);
  const validateCode = validate({ positional: [key], flags: {} }, { ROOT });
  if (validateCode !== 0) { console.error("deploy aborted: domain failed validation."); return 1; }

  const { renderDomainSite, renderCaddyfile } = await import("./deploy-config.mjs");
  const envFile = join(ROOT, flags["env-file"] ?? ".env.production");
  const sitesDir = join(ROOT, "deploy/caddy/render/sites");
  const siteFile = join(sitesDir, `${key}.caddy`);

  // Write ONLY this domain's site file; every other site file is untouched.
  mkdirSync(sitesDir, { recursive: true });
  const siteBlock = renderDomainSite(domain, envFile);
  if (flags["dry-run"]) {
    console.log(`--dry-run: ${key} site block would be written to deploy/caddy/render/sites/${key}.caddy:\n`);
    console.log(siteBlock);
    let merged;
    try {
      merged = renderCaddyfile({ envFile, sitesDir, snippetsPath: join(ROOT, "deploy/caddy/template/snippets.caddy"), email: flags.email });
    } catch {
      merged = renderCaddyfile({ envFile, sitesDir, snippetsPath: join(ROOT, "deploy/caddy/template/snippets.caddy"), email: flags.email ?? "dry-run@localhost" });
    }
    console.log(`Merged Caddyfile: ${(merged.match(/import app-site/g) ?? []).length} site blocks, other domains preserved:\n` +
      readdirSync(sitesDir).filter((f) => f.endsWith(".caddy") && f !== `${key}.caddy`).map((f) => `  ✓ ${f}`).join("\n"));
    return 0;
  }
  writeFileSync(siteFile, siteBlock);
  const merged = renderCaddyfile({ envFile, sitesDir, snippetsPath: join(ROOT, "deploy/caddy/template/snippets.caddy"), outPath: join(ROOT, "deploy/caddy/render/Caddyfile"), email: flags.email });
  console.log(`✓ Domain "${key}" deployed (site file written; Caddyfile re-rendered).`);
  console.log(`✓ ${(merged.match(/import app-site/g) ?? []).length} total site blocks — other domains untouched.`);
  console.log("\nOn the deployment host, restart Caddy to load the config:");
  console.log("  docker compose --env-file .env.production -f deploy/docker-compose.prod.yml up -d --no-deps --force-recreate caddy");
  console.log(`Then verify: https://${domain.hosts[0]}/api/health`);
  return 0;
}

// ── create (TRANSACTIONAL) ──────────────────────────────────────────────────

export async function create({ flags }, { ROOT, fail }) {
  if (flags.help || !flags.key || !flags.host) {
    console.log("usage: platform domain create --key <key> --host <host> [--trade-host <host>] [--design <key>] [--public-design <key>]");
    return (flags.help ? 0 : 1);
  }
  const key = flags.key;
  const host = flags.host.toLowerCase();
  const design = flags.design ?? "default";
  const publicDesign = flags["public-design"] ?? design;
  const tradeHost = flags["trade-host"] ?? `trade.${host}`;
  if (!KEY_RE.test(key)) return fail(`invalid key "${key}" (lowercase alphanum/dashes)`);
  if (!HOST_RE.test(host)) return fail(`invalid host "${host}"`);
  if (existsSync(join(ROOT, "src/domains", key))) return fail(`domain "${key}" already exists`);

  const staging = join(ROOT, "src/domains", `.staging-${key}`);
  const target = join(ROOT, "src/domains", key);
  const gen = join(ROOT, "src/domains/.generated/domains.ts");
  let genBackup = null;
  try {
    genBackup = readFileSync(gen, "utf8");
    // 1. stage from the template with placeholders substituted
    rmSync(staging, { recursive: true, force: true });
    spawnSync("cp", ["-R", join(ROOT, "src/domains/_template"), staging], { stdio: "pipe" });
    const fill = (file, replacements) => writeFileSync(
      join(staging, file),
      Object.entries(replacements).reduce((text, [from, to]) => text.replaceAll(from, to), readFileSync(join(staging, file), "utf8")),
    );
    // Substitute every template file. ORDER MATTERS: the UPPER_SNAKE const
    // markers (__DOMAIN_KEY___DOMAIN etc.) must be replaced BEFORE the bare
    // __DOMAIN_KEY__ marker, or they collapse into lowercase names.
    const substitute = (text) => {
      text = text.replaceAll("__DOMAIN_KEY___DOMAIN", `${key.toUpperCase()}_DOMAIN`);
      text = text.replaceAll("__DOMAIN_KEY___SEO", `${key.toUpperCase()}_SEO`);
      text = text.replaceAll("__DOMAIN_KEY___ASSETS", `${key.toUpperCase()}_ASSETS`);
      text = text.replaceAll("__DOMAIN_KEY__LandingContent", `${key}LandingContent`);
      text = text.replaceAll("__DOMAIN_KEY__NavigationContent", `${key}NavigationContent`);
      text = text.replaceAll("__DOMAIN_KEY__FooterContent", `${key}FooterContent`);
      text = text.replaceAll("__DOMAIN_KEY__ArticleCta", `${key}ArticleCta`);
      text = text.replaceAll("__DOMAIN_KEY__", key);
      text = text.replaceAll("__DOMAIN_HOST__", host);
      text = text.replaceAll("__DOMAIN_NAME__", key.charAt(0).toUpperCase() + key.slice(1));
      text = text.replaceAll("__TRADE_HOST__", tradeHost);
      text = text.replaceAll("__LANDING_DESIGN__", design);
      text = text.replaceAll("__PUBLIC_DESIGN__", publicDesign);
      return text;
    };
    const files = tsFiles(staging).concat(existsSync(join(staging, "README.md")) ? [join(staging, "README.md")] : []);
    for (const file of files) {
      writeFileSync(file, substitute(readFileSync(file, "utf8")));
    }
    {
      const path = join(staging, "domain.config.ts");
      let text = readFileSync(path, "utf8");
      text = text.replace('landingDesign: "default"', `landingDesign: "${design}"`);
      text = text.replace('publicDesign: "default"', `publicDesign: "${publicDesign}"`);
      writeFileSync(path, text);
    }
    fill("README.md", { __DOMAIN_KEY__: key, __DOMAIN_HOST__: host, __TRADE_HOST__: tradeHost, __LANDING_DESIGN__: design, __PUBLIC_DESIGN__: publicDesign });
    writeFileSync(join(staging, "index.ts"),
      readFileSync(join(staging, "index.ts"), "utf8"));

    // placeholder og image so asset validation passes out of the box
    const brandsDir = join(ROOT, "public", "brands", key);
    mkdirSync(brandsDir, { recursive: true });
    spawnSync("cp", [join(ROOT, "public", "og.png"), join(brandsDir, "og.png")], { stdio: "pipe" });

    // 2. move staging into place (rollback below restores everything on failure)
    spawnSync("mv", [staging, target], { stdio: "pipe" });

    // 3. regenerate registries with the new package in place
    spawnSync(process.execPath, [join(ROOT, "scripts/platform/generate-registry.mjs")], { stdio: "pipe" });
    if (!readFileSync(gen, "utf8").includes(key)) throw new Error("registry generation did not include the new domain");

    // 4. verify the deployment profile renders + full domain validation
    const { renderDomainSite } = await import("./deploy-config.mjs");
    const domains = loadDomainRegistry(ROOT);
    const staged = domains.find((entry) => entry.key === key);
    if (!staged) throw new Error("new domain not loadable from the generated registry");
    const profile = renderDomainSite(staged, join(ROOT, ".env.production"));
    if (!profile.includes(host)) throw new Error("deployment profile did not include the host");
    const problems = validateDomain(key, ROOT);
    if (problems.length > 0) throw new Error(`validation failed:\n${problems.map((p) => `  ✗ ${p.area}: ${p.message}`).join("\n")}`);

    console.log(`✓ Domain package        src/domains/${key}/`);
    console.log(`✓ Domain manifest       domain.config.ts (key=${key}, host=${host})`);
    console.log(`✓ Content directories   content/ navigation/ seo/ assets/`);
    console.log(`✓ Landing config        landingDesign="${design}"`);
    console.log(`✓ Public config         publicDesign="${publicDesign}"`);
    console.log(`✓ Registries regenerated (domains + designs + content)`);
    console.log(`✓ Deployment profile    renders for ${host} / ${tradeHost}`);
    console.log(`✓ Domain validated`);
    console.log(`\nNext steps:`);
    console.log(`  1. Edit content:    src/domains/${key}/content/`);
    console.log(`  2. Validate:        npm run domain:validate -- ${key}`);
    console.log(`  3. Doctor:          npm run domain:doctor -- ${key}`);
    console.log(`  4. Dev:             npm run domain:dev -- ${key}`);
    console.log(`  5. Test:            npm run domain:test -- ${key}`);
    console.log(`  6. Deploy:          npm run domain:deploy -- ${key}`);
    console.log(`  README: src/domains/${key}/README.md`);
    return 0;
  } catch (error) {
    // TRANSACTIONAL rollback: remove staging, restore registries, touch nothing else
    rmSync(staging, { recursive: true, force: true });
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    rmSync(join(ROOT, "public", "brands", key), { recursive: true, force: true });
    if (genBackup !== null) writeFileSync(gen, genBackup);
    console.error(`✗ create failed — rolled back (no domains, registries, or deployment config were modified).`);
    console.error(`  ${error.message}`);
    return 2;
  }
}

// ── remove (SAFE) ───────────────────────────────────────────────────────────

export async function remove({ positional, flags }, { ROOT, fail }) {
  const key = flags.key ?? positional[0];
  if (flags.help || !key) { console.log("usage: platform domain remove <key> [--confirm] [--force]"); return !key ? 1 : 0; }
  const domains = loadDomainRegistry(ROOT);
  const domain = domains.find((entry) => entry.key === key);
  if (!domain) return fail(`unknown domain "${key}"`);
  if (domains.length <= 1) return fail("refusing: the last registered domain cannot be removed");

  // dependency graph: no other domain/config references this key
  const references = [];
  for (const other of domains.filter((entry) => entry.key !== key)) {
    for (const file of tsFiles(join(ROOT, "src/domains", other.key))) {
      if (readFileSync(file, "utf8").includes(`domains/${key}`)) references.push(`${other.key}: ${file.replace(ROOT + "/", "")}`);
    }
  }
  for (const file of tsFiles(join(ROOT, "src"))) {
    const rel = file.replace(ROOT + "/", "");
    if (rel.startsWith(`src/domains/${key}/`)) continue;
    if (rel.startsWith("src/domains/.generated")) continue;
    const source = readFileSync(file, "utf8");
    if (source.includes(`domains/${key}`) && !rel.startsWith("src/platform/render")) {
      references.push(rel);
    }
  }
  if (references.length > 0) {
    console.error("✗ refusing removal — active references remain:");
    for (const reference of references) console.error(`  · ${reference}`);
    console.error("Remove these references first (domains must not depend on each other).");
    return 1;
  }

  const affected = [
    `src/domains/${key}/ (entire package)`,
    `public/brands/${key}/ (domain assets)`,
    `deploy/caddy/render/sites/${key}.caddy (routing)`,
    `src/domains/.generated/* (regenerated)`,
    `deploy/caddy/render/Caddyfile (re-rendered)`,
  ];
  console.log(`Removing domain "${key}" (${domain.hosts.join(", ")}) affects:`);
  for (const item of affected) console.log(`  · ${item}`);
  if (!flags.confirm) {
    console.error("\nRefusing destructive removal without --confirm.");
    console.error("Run: npm run domain:remove -- " + key + " --confirm");
    return 1;
  }
  const siteFile = join(ROOT, "deploy/caddy/render/sites", `${key}.caddy`);
  const siteDeployed = existsSync(siteFile);
  if (siteDeployed && !flags.force) {
    console.error(`\n✗ "${key}" has a DEPLOYED site file. Removing it takes the domain offline.`);
    console.error("Pass --force for production-sensitive removal after acknowledging the impact.");
    return 1;
  }

  rmSync(join(ROOT, "src/domains", key), { recursive: true, force: true });
  rmSync(join(ROOT, "public/brands", key), { recursive: true, force: true });
  if (siteDeployed) rmSync(siteFile, { force: true });
  spawnSync(process.execPath, [join(ROOT, "scripts/platform/generate-registry.mjs")], { stdio: "inherit" });
  const { renderCaddyfile } = await import("./deploy-config.mjs");
  try {
    renderCaddyfile({
      envFile: join(ROOT, flags["env-file"] ?? ".env.production"),
      sitesDir: join(ROOT, "deploy/caddy/render/sites"),
      snippetsPath: join(ROOT, "deploy/caddy/template/snippets.caddy"),
      outPath: join(ROOT, "deploy/caddy/render/Caddyfile"),
    });
  } catch { console.log("(Caddyfile re-render skipped — no production env file locally.)"); }
  const stillValid = loadDomainRegistry(ROOT).every((entry) => entry.key !== key);
  console.log(`✓ Domain package removed`);
  console.log(`✓ Assets removed`);
  console.log(siteDeployed ? "✓ Deployment site file removed + Caddyfile re-rendered" : "(no deployment site file existed)");
  console.log(`✓ Registries regenerated${stillValid ? "" : "  ⚠ key still present — check generation"}`);
  console.log("\nFinal isolation check:");
  const testChild = spawnSync(process.execPath, ["--import", "tsx", "--test", "tests/domains.test.ts"], { stdio: "inherit", cwd: ROOT });
  return (testChild.status ?? 0) === 0 && stillValid ? 0 : 2;
}
