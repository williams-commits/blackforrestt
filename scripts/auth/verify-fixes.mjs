#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(process.argv[2] ?? ".");
const checks = [];

async function source(path) {
  return readFile(resolve(root, path), "utf8");
}

function check(name, condition, detail) {
  checks.push({ name, passed: Boolean(condition), detail });
  console.log(`${condition ? "✓" : "✗"} ${name}: ${detail}`);
}

const [navbar, logo, login, device, authRoute, env, compose, packageJson] = await Promise.all([
  source("src/components/landing/Navbar.tsx"),
  source("src/components/trade/Logo.tsx"),
  source("src/app/login/page.tsx"),
  source("src/lib/device.ts"),
  source("src/app/api/auth/[...nextauth]/route.ts"),
  source(".env.example"),
  source("docker-compose.yml"),
  source("package.json"),
]);

check(
  "navbar has one logo anchor",
  /<div[^>]*>\s*<Logo\b[^>]*\/>\s*<\/div>/s.test(navbar) && !/<Link[^>]*>\s*<Logo/s.test(navbar),
  "Navbar must not wrap the link-producing Logo in another Link",
);
check(
  "logo owns the home link",
  /<Link href="\/"/.test(logo),
  "Logo remains the single home-page anchor",
);
check(
  "login performs cookie-safe navigation",
  /window\.location\.assign\(callbackUrl\)/.test(login),
  "successful credentials login performs a full navigation",
);
check(
  "login distinguishes service errors",
  /signInFailureMessage/.test(login) && /AUTH_SERVICE_MESSAGE/.test(login),
  "infrastructure failures are not reported as a bad password",
);
check(
  "device identity has randomUUID fallback",
  /getRandomValues/.test(device) && /legacy-/.test(device),
  "login remains usable when crypto.randomUUID is unavailable",
);
check(
  "Auth.js route is dynamic Node runtime",
  /runtime = "nodejs"/.test(authRoute) && /dynamic = "force-dynamic"/.test(authRoute),
  "credential callbacks cannot be statically cached or moved to Edge",
);
check(
  "AUTH_URL documented",
  /^AUTH_URL=/m.test(env) && /AUTH_URL:/m.test(compose),
  "Auth.js receives an explicit public origin",
);
const scripts = JSON.parse(packageJson).scripts ?? {};
check(
  "authentication doctor available",
  typeof scripts["auth:doctor"] === "string",
  "operators can verify database, seed, password, lock, MFA, host, and Redis readiness",
);

const failures = checks.filter((item) => !item.passed);
console.log(`\n${JSON.stringify({ kind: "login_fix_verification", passed: failures.length === 0, checks }, null, 2)}`);
if (failures.length > 0) process.exitCode = 1;
