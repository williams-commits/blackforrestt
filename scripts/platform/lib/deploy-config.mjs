/**
 * Deployment configuration library — derives everything from the domain
 * manifests (via a TSX import of the generated registry). ONE source of
 * truth for hosts, trade hosts, and site routing. No numbered domain slots.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Import the generated domain registry through tsx (pure data, no React). */
export function loadDomains() {
  const script = `
    import { DOMAINS } from ${JSON.stringify(join(ROOT, "src/domains/.generated/domains.ts"))};
    console.log(JSON.stringify(DOMAINS));
  `;
  const out = execFileSync(
    process.execPath,
    ["--import", "tsx", "--eval", script],
    { cwd: ROOT, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
  );
  return JSON.parse(out);
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

/** The domains this deployment serves: DEPLOY_DOMAINS env (comma list)
 *  restricts the registry; default = all registered domains. */
export function deploymentDomains(envFile) {
  const all = loadDomains();
  const scoped = envValue(envFile, "DEPLOY_DOMAINS")
    .split(",").map((entry) => entry.trim()).filter(Boolean);
  if (scoped.length === 0) return all;
  const byKey = new Map(all.map((domain) => [domain.key, domain]));
  const selected = scoped.map((key) => byKey.get(key)).filter(Boolean);
  if (selected.length === 0) {
    throw new Error(`DEPLOY_DOMAINS lists no known domain keys: ${scoped.join(", ")}`);
  }
  return selected;
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
      lines.push(`# trade host (${domain.key})`, `${tradeSub}.${apex} {`, "  import app-site", "}", "");
    }
  }
  return lines.join("\n") + "\n";
}

/** Assemble the complete Caddyfile: header + snippets + every deployed site
 *  file + CRM. Per-domain site files are the deployment state — writing one
 *  never touches the others (deploy-preservation guarantee). */
/** @param {{ envFile?: string, sitesDir?: string, snippetsPath?: string, outPath?: string, email?: string }} args */
export function renderCaddyfile({ envFile, sitesDir, snippetsPath, outPath, email: emailOverride, domains: domainsOverride } = {}) {
  const email = emailOverride ?? envValue(envFile, "CADDY_EMAIL");
  if (!email) throw new Error("CADDY_EMAIL is not set in the environment file.");
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
