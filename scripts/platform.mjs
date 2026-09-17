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
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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
      const envFile = join(ROOT, flags["env-file"] ?? ".env.production");
      const out = flags.out ?? join(ROOT, "deploy/caddy/render/Caddyfile");
      // DEPLOY_DOMAINS scoping: read from the env file (or --domains flag).
      let domainsScope = null;
      const domainsFlag = flags.domains;
      if (domainsFlag && domainsFlag !== true) {
        // explicit comma list: resolve keys against the registry (via tsx)
        const { execFileSync } = await import("node:child_process");
        const keys = String(domainsFlag).split(",").map((k) => k.trim()).filter(Boolean);
        const all = JSON.parse(execFileSync(process.execPath,
          ["--import", "tsx", "--eval",
           `import { DOMAINS } from ${JSON.stringify(join(ROOT, "src/domains/.generated/domains.ts"))};console.log(JSON.stringify(DOMAINS));`],
          { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
        const resolved = keys.map((k) => all.find((d) => d.key === k)).filter(Boolean);
        if (resolved.length === 0) { console.error(`platform: --domains lists no known keys: ${keys.join(", ")}`); return 1; }
        domainsScope = resolved;
      } else {
        // DEPLOY_DOMAINS from the env file (default: all registry domains)
        const { deploymentDomains } = await import("./platform/lib/deploy-config.mjs");
        try { domainsScope = deploymentDomains(envFile); } catch { domainsScope = null; }
      }
      const output = renderCaddyfile({
        envFile,
        sitesDir: join(ROOT, "deploy/caddy/render/sites"),
        snippetsPath: join(ROOT, "deploy/caddy/template/snippets.caddy"),
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
