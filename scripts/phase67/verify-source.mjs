#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const requiredFiles = [
  "ENTERPRISE_PHASE_6.md",
  "VERIFICATION_PHASE_6.md",
  "ENTERPRISE_PHASE_7.md",
  "VERIFICATION_PHASE_7.md",
  "prisma/migrations/20260728010000_enterprise_admin_rbac/migration.sql",
  "src/server/adminPolicy.ts",
  "src/server/admin.ts",
  "src/server/adminChanges.ts",
  "src/server/audit.ts",
  "src/server/auditRedaction.ts",
  "src/server/riskPolicy.ts",
  "src/lib/marketFreshness.ts",
  "src/components/admin/AdminWorkspace.tsx",
  "src/components/trade/MarketStatusBanner.tsx",
  "src/components/account/AccountReconciliationStatus.tsx",
  "tests/enterprisePhase67.test.ts",
  "tests/admin.integration.test.ts",
];
const roles = ["SUPER_ADMIN", "COMPLIANCE", "FINANCE", "DEALER", "RISK", "SUPPORT", "AUDITOR"];
const failures = [];

async function text(path) {
  try {
    return await readFile(resolve(root, path), "utf8");
  } catch {
    failures.push(`missing required file: ${path}`);
    return "";
  }
}

for (const path of requiredFiles) {
  try {
    const info = await stat(resolve(root, path));
    if (!info.isFile()) failures.push(`required path is not a file: ${path}`);
  } catch {
    failures.push(`missing required file: ${path}`);
  }
}

const schema = await text("prisma/schema.prisma");
const policy = await text("src/server/adminPolicy.ts");
for (const role of roles) {
  if (!schema.includes(role)) failures.push(`Prisma administrator role missing: ${role}`);
  if (!policy.includes(role)) failures.push(`permission policy role missing: ${role}`);
}

const changes = await text("src/server/adminChanges.ts");
for (const marker of ["Maker-checker policy requires a different reviewer", "final active SUPER_ADMIN", "commandKey"]) {
  if (!changes.toLowerCase().includes(marker.toLowerCase())) failures.push(`maker-checker control missing: ${marker}`);
}
if (!policy.includes("canReviewChangeDomain")) failures.push("domain-qualified reviewer policy missing");

const audit = await text("src/server/audit.ts");
for (const marker of ["verifyAuditChain", "csv", "ndjson", "redactAuditValue"]) {
  if (!audit.toLowerCase().includes(marker.toLowerCase())) failures.push(`audit capability missing: ${marker}`);
}

const hub = await text("src/server/engine/hub.ts");
const panel = await text("src/components/trade/TradePanel.tsx");
const banner = await text("src/components/trade/MarketStatusBanner.tsx");
for (const [path, source, markers] of [
  ["src/server/engine/hub.ts", hub, ["loadTradingRiskPolicy", "executable quote is stale"]],
  ["src/components/trade/TradePanel.tsx", panel, ["isExecutableQuote", "Pending provider acceptance"]],
  ["src/components/trade/MarketStatusBanner.tsx", banner, ["Quote source", "Freshness:"]],
]) {
  for (const marker of markers) if (!source.includes(marker)) failures.push(`${path} missing trust marker: ${marker}`);
}

const layout = await text("src/app/layout.tsx");
const contentLayout = await text("src/app/(content)/layout.tsx");
if (!layout.includes("skip-link")) failures.push("global skip link missing");
if (!contentLayout.includes('id="main-content"')) failures.push("marketing shell main-content target missing");

const result = {
  kind: "phase67_source_contract",
  generatedAt: new Date().toISOString(),
  root,
  requiredFileCount: requiredFiles.length,
  roles,
  passed: failures.length === 0,
  failures: [...new Set(failures)],
};
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
