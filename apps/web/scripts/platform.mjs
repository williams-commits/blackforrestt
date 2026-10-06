#!/usr/bin/env node
/**
 * platform — the ONE discoverable platform CLI.
 *
 *   platform registry generate           regenerate the generated registries
 *   platform caddy render [--env-file F] [--out P] [--email E]
 *   platform domain create|validate|doctor|dev|test|deploy|remove <key> [--help]
 *
 * npm aliases (domain:create, domain:validate, …) call into this dispatcher.
 * Every command: --help, actionable errors, deterministic exit codes
 * (0 ok / 1 usage or validation failure / 2 runtime failure).
 */
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [,, group, command, ...rest] = process.argv;

function help() {
  console.log(`platform — multi-domain platform CLI

Usage:
  platform registry generate
  platform caddy render [--env-file <path>] [--out <path>] [--email <addr>]
  platform domain create --key <key> --host <host> [--trade-host <host>] [--design <key>] [--public-design <key>]
  platform domain validate <key>
  platform domain doctor <key> [--json]
  platform domain dev <key>
  platform domain test <key> [--live]
  platform domain deploy <key> [--dry-run] [--env-file <path>]
  platform domain remove <key> [--confirm] [--force]

Aliases: npm run domain:create|validate|doctor|dev|test|deploy|remove`);
}

function fail(message, code = 1) {
  console.error(`platform: ${message}`);
  console.error("Run with --help for usage.");
  process.exit(code);
}

function parseFlags(args) {
  const flags = {}; const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const [name] = args[i].slice(2).split("=");
      if (args[i].includes("=")) flags[name] = args[i].slice(args[i].indexOf("=") + 1);
      else if (i + 1 < args.length && !args[i + 1].startsWith("--")) flags[name] = args[++i];
      else flags[name] = true;
    } else positional.push(args[i]);
  }
  return { flags, positional };
}

async function main() {
  if (!group || group === "--help" || group === "help") { help(); return 0; }

  if (group === "registry") {
    if (command === "generate") {
      const result = spawnSync(process.execPath, [join(ROOT, "scripts/platform/generate-registry.mjs")], { stdio: "inherit" });
      if (result.error) { console.error(`platform: registry generate failed to spawn: ${result.error.message}`); return 2; }
      return result.status ?? 2; // 0 on success; non-zero on generator failure/crash
    }
    return fail(`unknown registry command: ${command ?? "(none)"}`);
  }

  if (group === "caddy") {
    if (command === "render") {
      const { flags } = parseFlags(rest);
      const { renderCaddyfile } = await import("./platform/lib/deploy-config.mjs");
      // resolve (not join): an absolute --env-file (e.g. a container mount
      // path) must not be concatenated under ROOT.
      const envFile = resolve(ROOT, flags["env-file"] ?? ".env.production");
      const sitesDir = join(ROOT, "..", "..", "deploy/caddy/render/sites");
      const out = resolve(ROOT, flags.out ?? join(ROOT, "..", "..", "deploy/caddy/render/Caddyfile"));
      // DEPLOY_DOMAINS scoping: read from the env file (or --domains flag).
      let domainsScope = null;
      const domainsFlag = flags.domains;
      const { deploymentDomains, resolveDomainSelectors, loadDomains } = await import("./platform/lib/deploy-config.mjs");
      if (domainsFlag && domainsFlag !== true) {
        // Explicit comma list (one-shot deploy scope from `make deploy <key>`):
        // selectors may be registry KEYS or served HOSTS; unknown names fail
        // loudly — a typo must never silently widen the scope.
        const selectors = String(domainsFlag).split(",").map((k) => k.trim()).filter(Boolean);
        domainsScope = resolveDomainSelectors(await loadDomains(), selectors);
      } else {
        // DEPLOY_DOMAINS from the env file. UNSET = all registry domains
        // (local-dev convenience). Set-but-unmatched THROWS — never fall
        // back to "all" when an explicit scope exists.
        domainsScope = await deploymentDomains(envFile);
      }
      // FIRST-DEPLOY SEED: every in-scope registry domain gets its site file
      // if missing — existing files are never overwritten (per-domain edits
      // are deployment state). Also guarantees the sites dir exists, so a
      // fresh checkout (old render layout, no sites/ yet) cannot ENOENT.
      mkdirSync(sitesDir, { recursive: true });
      if (Array.isArray(domainsScope) && domainsScope.length > 0) {
        const { renderDomainSite } = await import("./platform/lib/deploy-config.mjs");
        for (const domain of domainsScope) {
          const siteFile = join(sitesDir, `${domain.key}.caddy`);
          if (!existsSync(siteFile)) {
            writeFileSync(siteFile, renderDomainSite(domain, envFile));
            console.log(`Seeded site file for "${domain.key}" → ${siteFile}`);
          }
        }
      }
      const output = renderCaddyfile({
        envFile,
        sitesDir,
        snippetsPath: join(ROOT, "..", "..", "deploy/caddy/template/snippets.caddy"),
        outPath: out,
        email: flags.email,
        domains: domainsScope,
      });
      const sites = (output.match(/import app-site/g) ?? []).length;
      console.log(`✓ Rendered ${out} — ${sites} active site block(s).`);
      return 0;
    }
    return fail(`unknown caddy command: ${command ?? "(none)"}`);
  }

  if (group === "domain") {
    const mod = await import("./platform/lib/domain-commands.mjs");
    if (!command || !mod[command]) return fail(`unknown domain command: ${command ?? "(none)"}`);
    return await mod[command](parseFlags(rest), { ROOT, help, fail });
  }

  return fail(`unknown command group: ${group}`);
}

main().then((code) => process.exit(code ?? 0)).catch((error) => {
  console.error(`platform: ${error.message}`);
  process.exit(2);
});
