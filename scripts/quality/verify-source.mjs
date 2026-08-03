import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const checks = [];
const failures = [];

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function check(name, condition, detail) {
  checks.push({ name, passed: Boolean(condition), detail });
  if (!condition) failures.push(`${name}: ${detail}`);
}

const storage = read("src/server/storage.ts");
const kyc = read("src/server/security/kycDocuments.ts");
const payments = read("src/server/payments.ts");
const email = read("src/server/email/service.ts");
const scanner = read("src/server/security/scanner.ts");
const server = read("server.ts");
const ws = read("src/server/ws/server.ts");
const reportsPage = read("src/app/reports/page.tsx");
const reconciliation = read("src/server/reconciliation.ts");
const preflight = read("scripts/production/preflight.mjs");

check(
  "document promotion is copy-first",
  storage.includes("export async function copyToSealed") &&
    storage.includes("export async function copyPaymentProofToSealed") &&
    !storage.includes("export async function moveToSealed") &&
    !storage.includes("export async function movePaymentProofToSealed"),
  "verified objects must remain in quarantine until PostgreSQL commits",
);
check(
  "KYC receive cleans orphaned uploads",
  /putQuarantineObject[\s\S]*try \{[\s\S]*withSerializableRetry[\s\S]*catch \(error\)[\s\S]*deleteObject/.test(kyc),
  "failed KYC row/audit transactions must delete the uploaded quarantine object",
);
check(
  "KYC finalization commits before cleanup",
  /copyToSealed[\s\S]*withSerializableRetry[\s\S]*deleteObject/.test(kyc),
  "KYC finalization must copy, commit metadata/audit, then remove quarantine",
);
check(
  "payment proof finalization commits before cleanup",
  /copyPaymentProofToSealed[\s\S]*withSerializableRetry[\s\S]*deleteObject/.test(payments),
  "payment proof finalization must copy, commit metadata/events, then remove quarantine",
);
check(
  "email crash recovery",
  email.includes('status: "PROCESSING"') &&
    email.includes("EMAIL_PROCESSING_TIMEOUT_MS") &&
    email.includes('status: "RETRY"') &&
    email.includes("Recovered an interrupted email delivery claim."),
  "stale PROCESSING jobs must return to the retry lane",
);
check(
  "email dispatcher is non-overlapping and drainable",
  email.includes("private activeRun") && email.includes("if (this.activeRun) return this.activeRun") && email.includes("await this.activeRun"),
  "dispatch passes must not overlap and shutdown must wait for the active pass",
);
check(
  "production engine startup is fail-closed",
  server.includes("Production startup aborted because the trading engine is not ready."),
  "production must not serve traffic when the market/account engine failed to initialize",
);
check(
  "storage client drains during shutdown",
  server.includes("closeStorage") && server.includes("await closeStorage()") && server.includes("await hub.shutdown().catch"),
  "graceful and failed startup paths must release the S3 client",
);
check(
  "WebSocket outbound backpressure",
  ws.includes("WS_MAX_BUFFERED_BYTES") && ws.includes("ws.bufferedAmount") && ws.includes('ws.close(1013'),
  "slow clients must be disconnected before their outbound queue grows without bound",
);
check(
  "production malware scanning is fail-closed",
  scanner.includes("class HttpScanner") &&
    scanner.includes("MALWARE_SCANNER_URL") &&
    preflight.includes('scanner !== "http"'),
  "production must require a configured real scanner adapter",
);
check(
  "trade reports use database pagination",
  reportsPage.includes("take: PAGE_SIZE") &&
    reportsPage.includes("skip: (page - 1) * PAGE_SIZE") &&
    reportsPage.includes("prisma.position.aggregate") &&
    !/findMany\(\{\s*where: \{ userId, status: \"CLOSED\" \},\s*orderBy/.test(reportsPage),
  "standalone reports must not load every closed position into server memory",
);
check(
  "reconciliation users are paged",
  reconciliation.includes("take: 100") &&
    reconciliation.includes("take: 250") &&
    reconciliation.includes("tx.reconciliationCase.groupBy") &&
    reconciliation.includes("prisma.user.count"),
  "full reconciliation and recovery must use bounded reads and database aggregates",
);

const result = {
  kind: "holistic_quality_source_verification",
  generatedAt: new Date().toISOString(),
  root,
  passed: failures.length === 0,
  checks,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
