#!/usr/bin/env node
/**
 * platform registry generate — scans domain manifests (src/domains/<key>/domain.config.ts)
 * and design manifests (src/designs/<key>/design.ts) and emits the generated
 * registries consumed by the app:
 *
 *   src/domains/.generated/domains.ts   pure domain manifest list (middleware/CSP-safe)
 *   src/domains/.generated/content.ts   domain key → lazy content loaders
 *   src/designs/.generated/designs.ts   design key → lazy design manifests
 *
 * Generated files are READ-ONLY artifacts: never edit by hand. CI verifies
 * freshness (tests/registry-freshness) and FAILS on drift.
 *
 * --check : READ-ONLY freshness check — compare the in-memory output to the
 * on-disk artifacts WITHOUT writing anything. Exit 0 = fresh, 1 = stale.
 * Used by `domain doctor` (which must never mutate the tree).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOMAINS_DIR = join(ROOT, "src", "domains");
const DESIGNS_DIR = join(ROOT, "src", "designs");

const HEADER = (source, command) =>
  `// GENERATED FILE — DO NOT EDIT.\n` +
  `// SOURCE: ${source.replace("*", "<key>")}\n` +
  `// REGENERATE: ${command}\n` +
  `// This file is a read-only build artifact; CI fails if it drifts from its sources.\n\n`;

function listPackages(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function extractExportedConst(file) {
  const source = readFileSync(file, "utf8");
  const match = source.match(/export const ([A-Z_]+)\s*:\s*DomainDefinition/);
  if (!match) throw new Error(`${file}: expected "export const <NAME>: DomainDefinition"`);
  return match[1];
}

function extractDesignKey(file) {
  const source = readFileSync(file, "utf8");
  const match = source.match(/key:\s*"([a-z0-9-]+)"/);
  if (!match) throw new Error(`${file}: expected "key: \\"<design-key>\\""`);
  return match[1];
}

const REGEN = "npm run platform -- registry generate";

// ── domains ─────────────────────────────────────────────────────────────────
const domainKeys = listPackages(DOMAINS_DIR);
const domainsLines = [HEADER("src/domains/*/domain.config.ts", REGEN)];
const contentLines = [HEADER("src/domains/*/index.ts (content loaders)", REGEN)];
domainsLines.push('import type { DomainDefinition } from "../../platform/registry-types";');
for (const key of domainKeys) {
  const name = extractExportedConst(join(DOMAINS_DIR, key, "domain.config.ts"), key);
  domainsLines.push(`import { ${name} } from "../${key}/domain.config";`);
}
domainsLines.push("");
domainsLines.push("/** Every registered domain manifest, priority order (first = default). */");
domainsLines.push(`export const DOMAINS: readonly DomainDefinition[] = [`);
for (const key of domainKeys) {
  const name = extractExportedConst(join(DOMAINS_DIR, key, "domain.config.ts"), key);
  domainsLines.push(`  ${name},`);
}
domainsLines.push("];");

contentLines.push('import type { DomainContentLoaders } from "../../content/contracts";');
contentLines.push("");
contentLines.push("/** Domain key → lazy content loaders (server-side only). */");
contentLines.push("export const DOMAIN_CONTENT: Record<string, () => Promise<DomainContentLoaders>> = {");
for (const key of domainKeys) contentLines.push(`  ${key}: async () => (await import("../${key}")).contentLoaders,`);
contentLines.push("};");

// ── designs ─────────────────────────────────────────────────────────────────
const designDirs = listPackages(DESIGNS_DIR);
const designLines = [HEADER("src/designs/*/design.ts", REGEN)];
designLines.push('import type { DesignManifest } from "../../designs/contracts";');
for (const dir of designDirs) {
  const key = extractDesignKey(join(DESIGNS_DIR, dir, "design.ts"));
  if (key !== dir) throw new Error(`src/designs/${dir}/design.ts: key "${key}" must match the folder name "${dir}"`);
  designLines.push(`import { design as ${key.replace(/-/g, "_")}Design } from "../${dir}/design";`);
}
designLines.push("");
designLines.push("/** Every registered design manifest. */");
designLines.push("export const DESIGN_MANIFESTS: Record<string, DesignManifest> = {");
for (const dir of designDirs) {
  const key = extractDesignKey(join(DESIGNS_DIR, dir, "design.ts"));
  designLines.push(`  [${key.replace(/-/g, "_")}Design.key]: ${key.replace(/-/g, "_")}Design,`);
}
designLines.push("};");

// ── client-safe composition map ─────────────────────────────────────────────
// Maps design keys → article layout module dynamic imports. CLIENT-SAFE:
// only references article layout files, NOT the landing/public shell
// components (which may transitively import server-only modules).
const PLATFORM_GEN = join(ROOT, "src", "platform", ".generated");
const compLines = [HEADER("src/designs/<key>/public/content/ (article layout files)", REGEN)];
compLines.push("// Client-safe: only article layout components — no landing/shell refs.");
compLines.push("// The composition dispatcher (src/platform/composition.tsx) uses lazy()");
compLines.push("// wrappers from these imports; Suspense handles the async boundary.");
compLines.push("");
compLines.push("export const ARTICLE_MODULE_IMPORTS: Record<string, () => Promise<Record<string, unknown>>> = {");
for (const dir of designDirs) {
  const articlePath = join(DESIGNS_DIR, dir, "public", "content");
  if (existsSync(articlePath)) {
    // Design with custom article layout — use its path
    const articleDir = join(DESIGNS_DIR, dir, "public", "content");
    if (existsSync(articleDir)) {
      const files = readdirSync(articleDir).filter((f) => f.endsWith(".tsx")).sort();
      if (files.length > 0) {
        const fileName = files[0].replace(/\.tsx$/, "");
        compLines.push(`  ${dir}: () => import("@/designs/${dir}/public/content/${fileName}"),`);
      } else {
        compLines.push(`  ${dir}: () => import("@/components/landing/ArticleLayout"),`);
      }
    } else {
      compLines.push(`  ${dir}: () => import("@/components/landing/ArticleLayout"),`);
    }
  } else {
    // Design using the default article layout from shared components
    compLines.push(`  ${dir}: () => import("@/components/landing/ArticleLayout"),`);
  }
}
compLines.push("};");

const outputs = [
  { path: join(DOMAINS_DIR, ".generated", "domains.ts"), content: domainsLines.join("\n") + "\n" },
  { path: join(DOMAINS_DIR, ".generated", "content.ts"), content: contentLines.join("\n") + "\n" },
  { path: join(DESIGNS_DIR, ".generated", "designs.ts"), content: designLines.join("\n") + "\n" },
  { path: join(PLATFORM_GEN, "composition-map.ts"), content: compLines.join("\n") + "\n" },
];

if (process.argv.includes("--check")) {
  let fresh = true;
  for (const { path, content } of outputs) {
    if (!existsSync(path)) { console.error(`✗ STALE ${rel(ROOT, path)} — missing (run: ${REGEN})`); fresh = false; continue; }
    if (readFileSync(path, "utf8") !== content) { console.error(`✗ STALE ${rel(ROOT, path)} — differs from sources (run: ${REGEN})`); fresh = false; }
  }
  if (fresh) console.log(`✓ Registries fresh: ${domainKeys.length} domain(s) [${domainKeys.join(", ")}], ${designDirs.length} design(s) — all ${outputs.length} artifacts match sources.`);
  process.exit(fresh ? 0 : 1);
}

mkdirSync(join(DOMAINS_DIR, ".generated"), { recursive: true });
mkdirSync(join(DESIGNS_DIR, ".generated"), { recursive: true });
mkdirSync(PLATFORM_GEN, { recursive: true });
for (const { path, content } of outputs) writeFileSync(path, content);
console.log(`✓ Generated registries: ${domainKeys.length} domain(s) [${domainKeys.join(", ")}], ${designDirs.length} design(s) [${designDirs.join(", ")}]`);

function rel(base, path) {
  return path.startsWith(base + "/") ? path.slice(base.length + 1) : path;
}
