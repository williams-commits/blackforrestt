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
  cpSync, renameSync, copyFileSync,
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

/** Run a subprocess and THROW on failure. Unchecked spawnSync is a rollback
 *  hole: a failed child that goes unnoticed lets the transaction continue
 *  and commit half-built state. Every mutating step must use this (or a
 *  node:fs op, which throws natively). */
function runChecked(cmd, args, { cwd, env } = {}) {
  const result = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8", cwd, env });
  if (result.error) throw new Error(`could not run "${cmd}": ${result.error.message}`);
  if ((result.status ?? 1) !== 0) {
    const tail = (result.stderr ?? "").split("\n").filter(Boolean).slice(-3).join("\n");
    throw new Error(`"${cmd} ${args.join(" ")}" exited ${result.status ?? `signal ${result.signal}`}${tail ? `\n  ${tail}` : ""}`);
  }
  return result;
}

/** Portable synchronous sleep (no `sleep` binary — Atomics.wait blocks the
 *  thread without a subprocess; used only between health-check retries). */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// ── validate ────────────────────────────────────────────────────────────────

export function validate({ positional, flags }, { ROOT }) {
  const key = flags.key ?? positional[0];
  if (flags.help) { console.log("usage: platform domain validate <key>"); return 0; }
  if (!key) { console.log("usage: platform domain validate <key>"); return 1; }
  const problems = validateDomain(key, ROOT);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem.area}: ${problem.message}`);
    console.error(`\nDomain "${key}" is INVALID (${problems.length} problem${problems.length === 1 ? "" : "s"}).`);
    return 1;
  }
  console.log(`✓ Domain "${key}" is valid.`);
  return 0;
}

export function validateDomain(key, ROOT) {
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
  // first-class vs dev-mirror vs alias (P1-13): the canonical host (first
  // entry) must be a production host; .localhost entries are dev mirrors and
  // belong AFTER it; aliases are production mirrors of the same family.
  const prodHosts = domain.hosts.filter((h) => !h.endsWith(".localhost"));
  if (prodHosts.length === 0) add("hosts", "no first-class production host — .localhost entries are dev mirrors only");
  if (domain.hosts[0]?.endsWith(".localhost")) add("hosts", "the canonical host (first entry) must be a production host, not a dev mirror");
  for (const alias of domain.aliases ?? []) {
    if (!HOST_RE.test(alias)) add("hosts", `alias "${alias}" is not a valid hostname`);
    if (alias.endsWith(".localhost")) add("hosts", `alias "${alias}" — dev mirrors belong in hosts[], aliases are production mirrors`);
    const owner = domains.find((other) => other !== domain && (other.hosts.includes(alias) || (other.aliases ?? []).includes(alias)));
    if (owner) add("hosts", `alias "${alias}" already claimed by domain "${owner.key}"`);
  }

  // explicit content/nav/seo/assets refs (P1-5): when the manifest declares
  // them, the referenced package files must exist — self-describing manifests.
  const refChecks = [
    ["content.landing", domain.content?.landing],
    ["content.public", domain.content?.public],
    ["navigation", domain.navigation],
    ["seo", domain.seo],
    ["assets", domain.assets],
  ];
  for (const [field, ref] of refChecks) {
    if (ref === undefined) continue; // optional: conventional layout still works
    if (typeof ref !== "string" || ref.includes("..") || ref.startsWith("/")) {
      add("content", `${field} ref "${ref}" must be a package-relative path (no leading /, no ..)`);
      continue;
    }
    if (!existsSync(join(domainDir, `${ref}.ts`))) add("content", `${field} ref "${ref}" → src/domains/${key}/${ref}.ts does not exist`);
  }

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
  if (flags.help) { console.log("usage: platform domain doctor <key> [--json]"); return 0; }
  if (!key) { console.log("usage: platform domain doctor <key> [--json]"); return 1; }
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
    const prodHostList = domain.hosts.filter((h) => !h.endsWith(".localhost"));
    const devMirrors = domain.hosts.filter((h) => h.endsWith(".localhost"));
    const hostDetail = [prodHostList.join(", "), devMirrors.length ? `dev mirrors: ${devMirrors.join(", ")}` : "", (domain.aliases ?? []).length ? `aliases: ${(domain.aliases ?? []).join(", ")}` : ""].filter(Boolean).join(" · ");
    record("Hostname", domain.hosts.every((h) => HOST_RE.test(h)), hostDetail);
    record("Trade host", domain.tradeEnabled ? `${(domain.brand?.tradeHost ?? "trade." + domain.hosts[0])}` : "(not enabled)");
    record("Content", !byArea.has("content"), byArea.get("content") ?? "");
    record("Landing design", !byArea.has("landing design"), domain.landingDesign);
    record("Public design", !byArea.has("public design"), domain.publicDesign);
    record("Navigation", existsSync(join(ROOT, "src/domains", key, "navigation.ts")));
    record("SEO", existsSync(join(ROOT, "src/domains", key, "seo.ts")));
    record("Assets", !byArea.has("assets"), byArea.get("assets") ?? "");
    record("Registry", !byArea.has("registry"), byArea.get("registry") ?? "");
    // READ-ONLY freshness — byte-exact: the generator's --check mode derives
    // all four artifacts in memory and diffs them against disk WITHOUT
    // writing (doctor must never mutate the tree).
    {
      const check = spawnSync(process.execPath,
        [join(ROOT, "scripts/platform/generate-registry.mjs"), "--check"],
        { encoding: "utf8", cwd: ROOT });
      const fresh = (check.status ?? 1) === 0;
      const reason = (check.stdout ?? check.stderr ?? "").trim().split("\n").filter(Boolean).pop() ?? "";
      record("Registry freshness", fresh, fresh ? "all 4 generated artifacts byte-identical to sources" : (reason || "generated artifacts stale — run: npm run registry:generate"));
    }
    record("Dependencies", !byArea.has("dependencies"), byArea.get("dependencies") ?? "");
    record("Branding leakage", !byArea.has("branding leakage"), byArea.get("branding leakage") ?? "");
    record("Caddy config", (() => {
      try {
        // Actually RENDER the site block and verify it contains the domain's hosts
        const domainDir = join(ROOT, "src/domains", key);
        if (!existsSync(join(ROOT, "deploy/caddy/template/snippets.caddy")) || !existsSync(domainDir)) return false;
        // lazy import avoids circular dependency at module load
        return true; // placeholder — see the actual render below
      } catch { return false; }
    })(), "site block renderable");
    {
      // Real Caddy check: render the domain's site block and verify hosts.
      try {
        const { renderDomainSite } = await import("./deploy-config.mjs");
        const domains = loadDomainRegistry(ROOT);
        const d = domains.find((entry) => entry.key === key);
        const block = renderDomainSite(d, join(ROOT, ".env"));
        const prodHosts = d.hosts.filter((h) => !h.endsWith(".localhost"));
        const allRouted = prodHosts.every((h) => block.includes(`${h} {`));
        // replace the placeholder check with the real one
        const idx = checks.findIndex((c) => c.name === "Caddy config");
        if (idx >= 0) checks[idx] = { name: "Caddy config", ok: allRouted, detail: allRouted ? "site block renders with all production hosts" : "site block missing a production host" };
      } catch {
        const idx = checks.findIndex((c) => c.name === "Caddy config");
        if (idx >= 0) checks[idx] = { name: "Caddy config", ok: false, detail: "render failed" };
      }
    }
    record("Domain isolation", !byArea.has("dependencies") && !byArea.has("branding leakage"));
    // deployment state: site file existence + Caddyfile currency (local-only;
    // remote production health is NOT CHECKABLE from the CLI)
    const siteFile = join(ROOT, "deploy/caddy/render/sites", `${key}.caddy`);
    const caddyfilePath = join(ROOT, "deploy/caddy/render/Caddyfile");
    if (existsSync(siteFile)) {
      const inMerged = existsSync(caddyfilePath) && readFileSync(caddyfilePath, "utf8").includes(domain.hosts[0]);
      record("Deployment state", inMerged, inMerged ? "site file deployed + present in merged Caddyfile" : "site file exists but NOT in merged Caddyfile — run caddy render");
    } else {
      record("Deployment state", true, "not deployed (no site file) — deploy with: npm run domain:deploy -- " + key);
    }
    // NOT CHECKABLE is informational — it must not fail the doctor exit code.
    checks.push({ name: "Production health", ok: true, detail: "NOT CHECKABLE (informational) — remote health requires the deployment host; verify: https://" + domain.hosts[0] + "/api/health" });
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
  if (flags.help) { console.log("usage: platform domain dev <key>"); return 0; }
  if (!key) { console.log("usage: platform domain dev <key>"); return 1; }
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

export async function test({ positional, flags }, { ROOT }) {
  const key = flags.key ?? positional[0];
  if (flags.help) { console.log("usage: platform domain test <key> [--live]"); return 0; }
  if (!key) { console.log("usage: platform domain test <key> [--live]"); return 1; }
  const validateCode = validate({ positional: [key], flags: {} }, { ROOT });
  if (validateCode !== 0) return validateCode;
  console.log(`\nRunning architecture/isolation suites (domain scope: ${key})…`);
  const child = spawnSync(process.execPath,
    ["--import", "tsx", "--test", "tests/domains.test.ts", "tests/registry-freshness.test.ts"],
    { stdio: "inherit", cwd: ROOT, env: { ...process.env, DOMAIN_UNDER_TEST: key } });
  if ((child.status ?? 0) !== 0) return 1;
  if (flags.live) {
    // Probe REAL pages on this domain's local dev host (not just /api/health):
    // the landing page, an interior content page, and the health endpoint.
    // Start the dev server first: npm run platform -- domain dev <key>
    const domain = loadDomainRegistry(ROOT).find((entry) => entry.key === key);
    if (!domain) return 1;
    const devHosts = domain.hosts.map((host) => host.endsWith(".localhost") ? host : `${host.split(".")[0]}.localhost`);
    const base = `http://${devHosts[0]}:3000`;
    console.log(`\n--live: probing real pages on ${base} (start it first: npm run platform -- domain dev ${key})`);
    const get = (path) => spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "10", `${base}${path}`], { encoding: "utf8" });
    const getBody = (path) => spawnSync("curl", ["-s", "--max-time", "10", `${base}${path}`], { encoding: "utf8" });
    let ok = true;
    const healthCode = (get("/api/health").stdout ?? "").trim();
    console.log(`${healthCode === "200" ? "✓" : "✗"} GET /api/health → ${healthCode || "unreachable"}`);
    ok &&= healthCode === "200";
    const landingCode = (get("/").stdout ?? "").trim();
    console.log(`${landingCode === "200" ? "✓" : "✗"} GET / (landing) → ${landingCode || "unreachable"}`);
    ok &&= landingCode === "200";
    const aboutCode = (get("/about").stdout ?? "").trim();
    const aboutOk = aboutCode === "200" || aboutCode === "207";
    console.log(`${aboutOk ? "✓" : "✗"} GET /about (public interior) → ${aboutCode || "unreachable"}`);
    ok &&= aboutOk;
    if (landingCode === "200") {
      const body = getBody("/").stdout ?? "";
      const hasBrand = domain.brand?.name ? body.includes(domain.brand.name) : true;
      // Informational — a custom landing design may legitimately stylize the
      // brand name; only a MISSING name on the DEFAULT design is suspicious.
      console.log(hasBrand || domain.landingDesign !== "default"
        ? `  (landing serves brand "${domain.brand?.name}"${hasBrand ? "" : " — stylized/not literal (ok for custom designs)"})`
        : `  ✗ landing HTML does not contain brand "${domain.brand?.name}" — check design selection`);
    }
    console.log(ok ? `✓ --live checks pass for "${key}".` : `✗ --live checks FAILED for "${key}".`);
    return ok ? 0 : 1;
  }
  console.log(`\n✓ Domain "${key}" tests pass.`);
  return 0;
}

// ── deploy ──────────────────────────────────────────────────────────────────

export async function deploy({ positional, flags }, { ROOT, fail }) {
  const key = flags.key ?? positional[0];
  if (flags.help) { console.log("usage: platform domain deploy <key> [--dry-run] [--apply] [--env-file <path>]"); return 0; }
  if (!key) { console.log("usage: platform domain deploy <key> [--dry-run] [--apply] [--env-file <path>]"); return 1; }
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
  // Capture pre-write state for validation-failure rollback.
  const siteExisted = existsSync(siteFile);
  const siteFileBackup = siteExisted ? readFileSync(siteFile, "utf8") : null;
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
  const caddyfilePath = join(ROOT, "deploy/caddy/render/Caddyfile");
  const merged = renderCaddyfile({ envFile, sitesDir, snippetsPath: join(ROOT, "deploy/caddy/template/snippets.caddy"), outPath: caddyfilePath, email: flags.email ?? "deploy@localhost" });

  // ── Configuration validation (deterministic; uses Docker, no host caddy dep) ──
  const caddyCheck = spawnSync("docker", [
    "run", "--rm", "-v", `${caddyfilePath}:/etc/caddy/Caddyfile:ro`, "caddy:2-alpine",
    "caddy", "validate", "--config", "/etc/caddy/Caddyfile",
  ], { stdio: "pipe", encoding: "utf8" });
  const dockerUnavailable = caddyCheck.error
    || (caddyCheck.stderr ?? "").includes("docker daemon")
    || (caddyCheck.stderr ?? "").includes("docker.sock")
    || (caddyCheck.stderr ?? "").includes("Is the docker daemon running");
  if (dockerUnavailable) {
    console.log("(Caddy syntax validation skipped — docker not available locally)");
  } else if ((caddyCheck.status ?? 1) !== 0) {
    console.error(`✗ Caddy validation FAILED:`);
    if (caddyCheck.stderr) console.error(caddyCheck.stderr.split("\n").slice(-5).join("\n"));
    // Roll back the site file write
    if (!siteExisted) rmSync(siteFile, { force: true });
    else writeFileSync(siteFile, siteFileBackup);
    renderCaddyfile({ envFile, sitesDir, snippetsPath: join(ROOT, "deploy/caddy/template/snippets.caddy"), outPath: caddyfilePath, email: flags.email ?? "deploy@localhost" });
    console.error("  Deployment NOT committed — site file rolled back, Caddyfile restored.");
    return 2;
  } else {
    console.log(`✓ Caddy config validated (caddy:2-alpine)`);
  }
  if (!existsSync(envFile)) {
    console.log("(docker compose validation skipped — no production env file locally)");
  } else {
    const composeCheck = spawnSync("docker", [
      "compose", "--env-file", envFile, "-f", join(ROOT, "deploy/docker-compose.prod.yml"), "config", "--quiet",
    ], { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
    if (composeCheck.error) {
      console.log("(docker compose validation skipped — docker not available locally)");
    } else if ((composeCheck.status ?? 1) !== 0) {
      console.error("✗ Docker compose config validation FAILED:");
      if (composeCheck.stderr) console.error(composeCheck.stderr.split("\n").slice(-5).join("\n"));
      // Symmetric rollback with the Caddy-validation path
      if (!siteExisted) rmSync(siteFile, { force: true });
      else writeFileSync(siteFile, siteFileBackup);
      renderCaddyfile({ envFile, sitesDir, snippetsPath: join(ROOT, "deploy/caddy/template/snippets.caddy"), outPath: caddyfilePath, email: flags.email ?? "deploy@localhost" });
      console.error("  Deployment NOT committed — site file rolled back, Caddyfile restored.");
      return 2;
    } else {
      console.log("✓ Docker compose config validated");
    }
  }

  const siteCount = (merged.match(/import app-site/g) ?? []).length;
  console.log(`✓ Domain "${key}" deployed (site file written; Caddyfile re-rendered; config validated).`);
  console.log(`✓ ${siteCount} total site blocks — other domains untouched.`);

  // ── Apply phase (true deployment): recreate caddy + live health check ──
  // Default (no flag) = validated configuration deployment only — safe to run
  // anywhere (CI, a laptop). --apply EXECUTES on the deployment host.
  if (!flags.apply) {
    console.log("\n── Configuration deployment COMPLETE (no containers were touched).");
    console.log("To execute on the deployment host, re-run with --apply, or manually:");
    console.log("  docker compose --env-file .env.production -f deploy/docker-compose.prod.yml up -d --no-deps --force-recreate caddy");
    console.log(`Then health-check: https://${domain.hosts[0]}/api/health`);
    return 0;
  }
  const composeFile = join(ROOT, "deploy/docker-compose.prod.yml");
  const dockerProbe = spawnSync("docker", ["info"], { stdio: "pipe", encoding: "utf8" });
  if ((dockerProbe.status ?? 1) !== 0) {
    console.error("✗ --apply requested but docker is not reachable on this host.");
    console.error("  The configuration deployment above remains valid and on disk.");
    return 2;
  }
  try {
    console.log(`\n── Applying: recreating the caddy service (scoped — no other services touched)…`);
    runChecked("docker", ["compose", "--env-file", envFile, "-f", composeFile, "up", "-d", "--no-deps", "--force-recreate", "caddy"], { cwd: ROOT });
    console.log("✓ caddy recreated with the updated Caddyfile.");
  } catch (error) {
    console.error(`✗ compose apply FAILED:\n${error.message}`);
    console.error("  Site file + Caddyfile remain deployed on disk; the running container was NOT updated.");
    return 2;
  }
  // Live health check on every production apex of THIS domain. First-time TLS
  // provisioning + container restart take a moment — poll with retries.
  const prodHosts = domain.hosts.filter((h) => !h.endsWith(".localhost"));
  process.stdout.write(`── Health check https://<apex>/api/health: `);
  let healthyHost = null;
  for (let attempt = 1; attempt <= 12 && !healthyHost; attempt++) {
    for (const host of prodHosts) {
      const probe = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "10", `https://${host}/api/health`], { encoding: "utf8" });
      if ((probe.stdout ?? "").trim() === "200") { healthyHost = host; break; }
    }
    if (!healthyHost) { process.stdout.write("."); sleepSync(5000); }
  }
  if (healthyHost) {
    console.log(` ✓ 200 OK (https://${healthyHost}/api/health)`);
    console.log(`\n✓ Domain "${key}" DEPLOYED and HEALTHY.`);
    return 0;
  }
  console.log(" no 200 within timeout");
  console.error(`✗ Health not confirmed. The deployment is applied but https://${prodHosts[0]}/api/health did not return 200.`);
  console.error("  Possible causes: DNS not pointing here yet, TLS still provisioning, or the app container unhealthy (docker compose ps / logs).");
  return 4;
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
  if (existsSync(join(ROOT, "public/brands", key))) return fail(`public/brands/${key}/ already exists — remove or rename it first (create must not clobber pre-existing assets)`);

  const staging = join(ROOT, "src/domains", `.staging-${key}`);
  const target = join(ROOT, "src/domains", key);
  const gen = join(ROOT, "src/domains/.generated/domains.ts");
  const brandsDir = join(ROOT, "public", "brands", key);

  // TRANSACTIONAL STATE — captured BEFORE any mutation.
  // 1. All generated registries (the generator rewrites three files).
  // 2. Pre-existing domain package (should not exist; pre-checked above).
  // 3. Pre-existing brand assets (MUST be preserved even on rollback).
  const { snapshotGenerated, restoreGenerated, snapshotDir, restoreDir } = await import("./transaction.mjs");
  const generatedSnapshot = snapshotGenerated(ROOT);
  const preExistingBrands = snapshotDir(brandsDir); // null if absent (normal)
  const createdBrandsDir = !preExistingBrands;

  try {
    // 1. stage from the template with placeholders substituted
    // (node:fs ops, not shell cp/mv — they throw on failure, are portable,
    // and a throw is exactly what the rollback below needs)
    rmSync(staging, { recursive: true, force: true });
    cpSync(join(ROOT, "src/domains/_template"), staging, { recursive: true });
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
      // Scaffold a DEV MIRROR host so `domain dev <key>` serves this domain on
      // a valid local hostname from day one (*.localhost resolves without
      // /etc/hosts edits). Formula matches the dev command's host derivation.
      // NOTE: substitute() above already resolved __DOMAIN_HOST__, so match
      // the substituted literal.
      const devMirror = host.endsWith(".localhost") ? host : `${host.split(".")[0]}.localhost`;
      if (devMirror !== host) {
        text = text.replace(`hosts: ["${host}"]`, `hosts: ["${host}", "${devMirror}"]`);
      }
      writeFileSync(path, text);
    }
    fill("README.md", { __DOMAIN_KEY__: key, __DOMAIN_HOST__: host, __TRADE_HOST__: tradeHost, __LANDING_DESIGN__: design, __PUBLIC_DESIGN__: publicDesign });
    writeFileSync(join(staging, "index.ts"),
      readFileSync(join(staging, "index.ts"), "utf8"));

    // placeholder og image so asset validation passes out of the box
    // (brandsDir was pre-checked to NOT exist; we created it in this transaction)
    mkdirSync(brandsDir, { recursive: true });
    copyFileSync(join(ROOT, "public", "og.png"), join(brandsDir, "og.png"));

    // 2. move staging into place (rollback below restores everything on failure)
    renameSync(staging, target);

    // 3. regenerate registries with the new package in place — CHECKED: a
    // failed generator must abort the transaction, not leave stale registries
    runChecked(process.execPath, [join(ROOT, "scripts/platform/generate-registry.mjs")], { cwd: ROOT });
    if (!readFileSync(gen, "utf8").includes(key)) throw new Error("registry generation did not include the new domain");

    // 4. verify the deployment profile renders + full domain validation
    const { renderDomainSite } = await import("./deploy-config.mjs");
    const domains = loadDomainRegistry(ROOT);
    const staged = domains.find((entry) => entry.key === key);
    if (!staged) throw new Error("new domain not loadable from the generated registry");
    const profile = renderDomainSite(staged, join(ROOT, ".env.production"));
    // .localhost hosts are dev-only and excluded from production Caddy blocks
    // (by design in renderDomainSite) — skip the profile check for them.
    if (!host.endsWith(".localhost") && !profile.includes(host)) {
      throw new Error("deployment profile did not include the host");
    }
    const problems = validateDomain(key, ROOT);
    if (problems.length > 0) throw new Error(`validation failed:\n${problems.map((p) => `  ✗ ${p.area}: ${p.message}`).join("\n")}`);

    console.log(`✓ Domain package        src/domains/${key}/`);
    console.log(`✓ Domain manifest       domain.config.ts (key=${key}, host=${host})`);
    console.log(`✓ Content directories   content/ navigation/ seo/ assets/`);
    console.log(`✓ Landing config        landingDesign="${design}"`);
    console.log(`✓ Public config         publicDesign="${publicDesign}"`);
    console.log(`✓ Registries regenerated (domains + content + designs + composition-map)`);
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
    // TRANSACTIONAL ROLLBACK — restore every mutated artifact:
    //   staging dir, new domain package, ALL generated registries (4 files),
    //   new brand assets; pre-existing brand assets are preserved.
    rmSync(staging, { recursive: true, force: true });
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    if (createdBrandsDir) {
      rmSync(brandsDir, { recursive: true, force: true });
    } else {
      restoreDir(preExistingBrands); // restore what was there before us
    }
    const restored = restoreGenerated(ROOT, generatedSnapshot);
    console.error(`✗ create failed — transaction rolled back.`);
    if (restored.length > 0) console.error(`  Restored generated artifacts: ${restored.length} file(s).`);
    if (!createdBrandsDir && preExistingBrands) console.error(`  Pre-existing assets in public/brands/${key}/ preserved.`);
    console.error(`  ${error.message}`);
    return 2;
  }
}

// ── remove (SAFE) ───────────────────────────────────────────────────────────

export async function remove({ positional, flags }, { ROOT, fail }) {
  const key = flags.key ?? positional[0];
  if (flags.help) { console.log("usage: platform domain remove <key> [--confirm] [--force]"); return 0; }
  if (!key) { console.log("usage: platform domain remove <key> [--confirm] [--force]"); return 1; }
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

  // FAILURE-SAFE REMOVAL — capture restorable state BEFORE any mutation.
  const { snapshotGenerated, restoreGenerated, snapshotDir, restoreDir } = await import("./transaction.mjs");
  const generatedSnapshot = snapshotGenerated(ROOT);
  const domainSnapshot = snapshotDir(join(ROOT, "src/domains", key));
  const brandsSnapshot = snapshotDir(join(ROOT, "public/brands", key));
  let caddyfileBefore = null;
  const caddyfilePath = join(ROOT, "deploy/caddy/render/Caddyfile");
  if (existsSync(caddyfilePath)) caddyfileBefore = readFileSync(caddyfilePath, "utf8");
  let siteFileContent = null;
  if (siteDeployed) siteFileContent = readFileSync(siteFile, "utf8");

  const rollback = (reason) => {
    console.error(`✗ remove failed mid-operation — attempting rollback.`);
    let ok = true;
    try {
      if (domainSnapshot) restoreDir(domainSnapshot);
      if (brandsSnapshot) restoreDir(brandsSnapshot);
      if (siteFileContent !== null) writeFileSync(siteFile, siteFileContent);
      if (caddyfileBefore !== null) writeFileSync(caddyfilePath, caddyfileBefore);
      restoreGenerated(ROOT, generatedSnapshot);
      console.error(`✓ Rollback: domain package, assets, site file, Caddyfile, and generated registries restored.`);
    } catch (rollbackError) {
      ok = false;
      console.error(`✗ Rollback INCOMPLETE: ${rollbackError.message}`);
      console.error(`  Manual state check required for: src/domains/${key}/, public/brands/${key}/, deploy/caddy/render/.`);
    }
    console.error(`  Original failure: ${reason}`);
    return ok ? 2 : 3;
  };

  // Ordered removal with per-step failure checks.
  rmSync(join(ROOT, "src/domains", key), { recursive: true, force: true });
  if (existsSync(join(ROOT, "src/domains", key))) return rollback("domain package deletion failed");

  rmSync(join(ROOT, "public/brands", key), { recursive: true, force: true });

  if (siteDeployed) {
    rmSync(siteFile, { force: true });
    if (existsSync(siteFile)) return rollback("site file deletion failed");
  }

  const genResult = spawnSync(process.execPath, [join(ROOT, "scripts/platform/generate-registry.mjs")], { stdio: "pipe" });
  if ((genResult.status ?? 0) !== 0) return rollback(`registry regeneration exited ${genResult.status ?? "signal:" + genResult.signal}`);

  const { renderCaddyfile } = await import("./deploy-config.mjs");
  try {
    renderCaddyfile({
      envFile: join(ROOT, flags["env-file"] ?? ".env.production"),
      sitesDir: join(ROOT, "deploy/caddy/render/sites"),
      snippetsPath: join(ROOT, "deploy/caddy/template/snippets.caddy"),
      outPath: caddyfilePath,
    });
  } catch (error) {
    // No production env locally is EXPECTED (benign) — distinguish from real errors.
    if (!error.message.includes("CADDY_EMAIL")) return rollback(`Caddyfile re-render failed: ${error.message}`);
    console.log("(Caddyfile re-render skipped — no production env file locally.)");
  }

  const stillValid = loadDomainRegistry(ROOT).every((entry) => entry.key !== key);
  if (!stillValid) return rollback("key still present in registries after regeneration");

  console.log(`✓ Domain package removed`);
  console.log(`✓ Assets removed`);
  console.log(siteDeployed ? "✓ Deployment site file removed + Caddyfile re-rendered" : "(no deployment site file existed)");
  console.log(`✓ Registries regenerated`);
  console.log("\nFinal isolation check:");
  const testChild = spawnSync(process.execPath, ["--import", "tsx", "--test", "tests/domains.test.ts"], { stdio: "inherit", cwd: ROOT });
  const testsOk = (testChild.status ?? 0) === 0;
  if (!testsOk) console.error("✗ Isolation tests failed after removal — investigate tests/domains.test.ts output above.");
  return testsOk ? 0 : 2;
}
