/**
 * Deployment configuration library — derives everything from the domain
 * manifests (via a TSX import of the generated registry). ONE source of
 * truth for hosts, trade hosts, and site routing. No numbered domain slots.
 */
import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Import the generated domain registry through tsx (pure data, no React). */
export async function loadDomains() {
  // In-process dynamic import (the CLI runs under tsx): the --eval child
  // route CJS-ified absolute-path static imports after the Phase 9 move.
  const mod = await import(pathToFileURL(join(ROOT, "src/domains/.generated/domains.ts")).href);
  return structuredClone(mod.DOMAINS);
}

/** Read one env value from a production env file (last wins, quotes stripped). */
export function envValue(envFile, name) {
  if (!existsSync(envFile)) return "";
  const lines = readFileSync(envFile, "utf-8").split("\n");
  let value = "";
  for (const line of lines) {
    const match = line.match(new RegExp(`^${name}=`));
    if (match) value = line.slice(line.indexOf("=") + 1);
  }
  return value.replace(/^"|"$/g, "").replace(/\/+$/, "").trim();
}

/** Resolve a list of domain selectors against the registry. A selector may
 *  be a registry KEY ("gbfxs") or a served HOST ("gbfxs.com") — hosts are
 *  accepted because DOMAIN/DOMAIN_N env slots naturally hold hosts.
 *  Every selector must resolve; unknown names fail loudly (never silently
 *  widen the deployment scope). */
export function resolveDomainSelectors(all, selectors) {
  const byKey = new Map(all.map((domain) => [domain.key, domain]));
  const selected = [];
  const unmatched = [];
  for (const selector of selectors) {
    const domain = byKey.get(selector)
      ?? all.find((d) => d.hosts.includes(selector));
    if (domain) selected.push(domain);
    else unmatched.push(selector);
  }
  if (unmatched.length > 0) {
    throw new Error(
      `Unknown domain selector(s): ${unmatched.join(", ")}. ` +
      `Known keys: ${all.map((d) => d.key).join(", ")}. ` +
      `Selectors may be registry keys (gbfxs) or served hosts (gbfxs.com).`
    );
  }
  return selected;
}

/** The domains this deployment serves: DEPLOY_DOMAINS env (comma list of
 *  keys or hosts) restricts the registry; UNSET = all registered domains
 *  (local-dev convenience). Set-but-unmatched is a hard error. */
export async function deploymentDomains(envFile) {
  const all = await loadDomains();
  const scoped = envValue(envFile, "DEPLOY_DOMAINS")
    .split(",").map((entry) => entry.trim()).filter(Boolean);
  if (scoped.length === 0) return all;
  return resolveDomainSelectors(all, scoped);
}

/** Every public host one domain serves: apex(es), www redirect, trade host. */
export function domainHosts(domain, envFile) {
  const tradeSub = envValue(envFile, "TRADE_SUBDOMAIN") || "trade";
  const hosts = [];
  for (const apex of domain.hosts) {
    hosts.push({ apex, kind: "apex" });
    hosts.push({ apex: `www.${apex}`, kind: "www", redirectTo: apex });
    hosts.push({
      apex: domain.tradeEnabled ? `${tradeSub}.${apex}` : `${tradeSub}.${apex}`,
      kind: "trade",
    });
  }
  return hosts;
}

/** Render ONE domain's Caddy site blocks (self-contained; merged by caller). */
export function renderDomainSite(domain, envFile) {
  const lines = [`# domain: ${domain.key}`];
  const tradeSub = envValue(envFile, "TRADE_SUBDOMAIN") || "trade";
  // Dev-only hosts (*.localhost) never get production routing/TLS blocks.
  const prodHosts = domain.hosts.filter((host) => !host.endsWith(".localhost"));
  for (const apex of prodHosts) {
    lines.push(`${apex} {`, "  import app-site", "}", "");
    lines.push(`# www → ${apex}`, `www.${apex} {`, `  redir https://${apex}{uri} permanent`, "}", "");
    if (domain.tradeEnabled) {
      lines.push(`# trade host (${domain.key})`, `${tradeSub}.${apex} {`, "  import trade-site", "}", "");
    }
  }
  return lines.join("\n") + "\n";
}

/** Assemble the complete Caddyfile: header + snippets + every deployed site
 *  file + CRM. Per-domain site files are the deployment state — writing one
 *  never touches the others (deploy-preservation guarantee). */
/** @param {{ envFile?: string, sitesDir?: string, snippetsPath?: string, outPath?: string, email?: string, domains?: Array<{key:string}> }} args */
export function renderCaddyfile({ envFile, sitesDir, snippetsPath, outPath, email: emailOverride, domains: domainsOverride } = {}) {
  const email = emailOverride ?? envValue(envFile, "CADDY_EMAIL");
  if (!email) {
    throw new Error(
      "CADDY_EMAIL is not set in the environment file. Add CADDY_EMAIL=you@example.com — " +
      "it is the contact address for TLS certificate renewal notices."
    );
  }
  const crmDomain = envValue(envFile, "CRM_DOMAIN");
  const snippets = readFileSync(snippetsPath, "utf-8");
  // DEPLOY_DOMAINS scoping: when provided, only the selected domains' site
  // files join the merged output; others are PRESERVED on disk.
  const scoped = domainsOverride ?? null;
  const parts = [
    `# GENERATED FILE — DO NOT EDIT. SOURCE: domain manifests + deployed site files\n# REGENERATE: npm run platform -- registry generate && deploy rendering\n`,
    `{\n  email ${email}\n  admin off\n}\n\n`,
    snippets + "\n",
  ];
  let siteFiles = readdirSync(sitesDir).filter((f) => f.endsWith(".caddy")).sort();
  if (scoped) {
    const allowed = new Set(scoped.map((d) => `${d.key}.caddy`));
    siteFiles = siteFiles.filter((f) => allowed.has(f));
  }
  for (const file of siteFiles) {
    parts.push(readFileSync(join(sitesDir, file), "utf-8"));
  }
  if (crmDomain) {
    parts.push(`# CRM\n${crmDomain} {\n  import crm-site\n}\n\n`);
  }
  const output = parts.join("");
  if (outPath) writeFileSync(outPath, output);
  return output;
}
