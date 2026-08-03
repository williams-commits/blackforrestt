#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import process from "node:process";

const root = resolve(process.argv[2] ?? ".");
const checks = [];
const source = async (path) => readFile(resolve(root, path), "utf8");
function check(name, condition, detail) {
  checks.push({ name, passed: Boolean(condition), detail });
  console.log(`${condition ? "✓" : "✗"} ${name}: ${detail}`);
}

const [
  navbar, dialog, assets, chart, dashboard, tradePage, positionHistory, transactions,
  paymentTimeline, paymentsReview, reconciliation, auth, login, packageJson, envExample,
  envDocs, candleFetcher, marketMode, server, compose, prodCompose, deployment,
  db, middleware,
] = await Promise.all([
  source("src/components/landing/Navbar.tsx"),
  source("src/components/ui/Dialog.tsx"),
  source("src/components/trade/AssetModal.tsx"),
  source("src/components/trade/ChartPanel.tsx"),
  source("src/components/trade/Dashboard.tsx"),
  source("src/app/trade/[symbol]/page.tsx"),
  source("src/components/account/PositionHistory.tsx"),
  source("src/components/account/TransactionsTab.tsx"),
  source("src/components/account/PaymentTimeline.tsx"),
  source("src/components/admin/PaymentsReview.tsx"),
  source("src/components/admin/ReconciliationReview.tsx"),
  source("src/auth.ts"),
  source("src/app/login/page.tsx"),
  source("package.json"),
  source(".env.example"),
  source("ENVIRONMENT_VARIABLES.md"),
  source("src/server/engine/candleFetcher.ts"),
  source("src/server/engine/marketDataMode.ts"),
  source("server.ts"),
  source("docker-compose.yml"),
  source("deploy/docker-compose.prod.yml"),
  source("DEPLOYMENT.md"),
  source("src/server/db.ts"),
  source("src/middleware.ts"),
]);

check("mobile navigation", /mobile-navigation/.test(navbar) && /100dvh/.test(navbar), "mobile menu is keyboard-closeable and viewport bounded");
check("dialog scroll contract", /max-h-\[100dvh\]/.test(dialog) && /overflow-hidden/.test(dialog), "dialogs provide a bounded flex container");
check("asset modal scroll", /min-h-0 flex-1 touch-pan-y overflow-y-auto/.test(assets), "asset results own the vertical scroll area");
check("asset pagination", /<Pagination/.test(assets) && /PAGE_SIZE = 24/.test(assets), "large instrument catalogs are paginated");
check("necessary list pagination", [positionHistory, transactions, paymentTimeline, paymentsReview, reconciliation].every((text) => /<Pagination/.test(text)), "account, payment and reconciliation lists have bounded pages");
check("chart professional controls", /HistogramSeries/.test(chart) && /CrosshairMode/.test(chart) && /Full screen/.test(chart), "chart includes volume, crosshair, indicators, zoom and full-screen controls");
check("chart minimum size", /min-h-\[28rem\]/.test(chart) && /min-h-\[24rem\]/.test(chart), "chart cannot collapse into a tiny panel");
check("timeframe persistence", /localStorage/.test(chart) && /params\.set\("tf"/.test(chart) && /CandleInterval \| null/.test(tradePage), "timeframe persists in URL and browser storage without forced 1m reset");
check("socket follows selected timeframe", /useForexSocket\(instrument\.symbol, interval\)/.test(dashboard), "WebSocket subscription uses store-selected timeframe");
check("login environment loading", /--env-file-if-exists=\.env/.test(packageJson), "development, seed and auth tools load .env explicitly");
check("no dev auth bypass", !/isDevAuthBypassEnabled|getDevUserId|AUTH_DEV_BYPASS/.test(db) && !/AUTH_DEV_BYPASS/.test(middleware) && !/AUTH_DEV_REPAIR_SEEDED_LOGIN/.test(auth), "the development-only seeded-user auth bypass and repair path have been removed");
check("cookie-safe login redirect", /window\.location\.assign\(callbackUrl\)/.test(login), "successful sign-in performs a full navigation after cookie issuance");
check("Finnhub entitlement circuit", /restCapability/.test(candleFetcher) && /HTTP \$\{status\}/.test(candleFetcher) && /FINNHUB_CANDLE_MODE/.test(marketMode), "401/403 historical entitlement failures stop repeated requests and preserve simulated history");
check("local reconciliation control", /RECONCILIATION_ENABLED/.test(server) && /RECONCILIATION_ENABLED/.test(envExample), "ordinary local UI development no longer starts reconciliation by default");
check("production deployment", /caddy:/.test(prodCompose) && /internal: true/.test(prodCompose) && /deploy\/restore\.sh/.test(deployment), "Caddy/TLS, internal data services, backup and restore are documented");
check("local Compose parity", /FINNHUB_CANDLE_MODE/.test(compose) && /RECONCILIATION_ENABLED/.test(compose), "new runtime controls are wired into Compose");

const runtimeVariables = new Set();
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "artifacts"].includes(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else if ([".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(extname(entry.name))) {
      const text = await readFile(absolute, "utf8");
      for (const match of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) runtimeVariables.add(match[1]);
      for (const match of text.matchAll(/process\.env\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\]/g)) runtimeVariables.add(match[1]);
    }
  }
}
await walk(root);
const undocumented = [...runtimeVariables].filter((name) => !envDocs.includes(`\`${name}\``)).sort();
check("environment documentation coverage", undocumented.length === 0, undocumented.length ? `missing: ${undocumented.join(", ")}` : `${runtimeVariables.size} runtime variables documented`);

const failures = checks.filter((item) => !item.passed);
const result = {
  kind: "release_hardening_source_contract",
  generatedAt: new Date().toISOString(),
  root,
  passed: failures.length === 0,
  checks,
  undocumentedEnvironmentVariables: undocumented,
};
console.log(`\n${JSON.stringify(result, null, 2)}`);
if (failures.length > 0) process.exitCode = 1;
