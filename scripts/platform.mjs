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
      spawnSync(process.execPath, [join(ROOT, "scripts/platform/generate-registry.mjs")], { stdio: "inherit" });
      return process.exitCode ?? 0;
    }
    return fail(`unknown registry command: ${command ?? "(none)"}`);
  }

  if (group === "caddy") {
    if (command === "render") {
      const { flags } = parseFlags(rest);
      const { renderCaddyfile } = await import("./platform/lib/deploy-config.mjs");
      const envFile = join(ROOT, flags["env-file"] ?? ".env.production");
      const out = flags.out ?? join(ROOT, "deploy/caddy/render/Caddyfile");
      const output = renderCaddyfile({
        envFile,
        sitesDir: join(ROOT, "deploy/caddy/render/sites"),
        snippetsPath: join(ROOT, "deploy/caddy/template/snippets.caddy"),
        outPath: out,
        email: flags.email,
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
