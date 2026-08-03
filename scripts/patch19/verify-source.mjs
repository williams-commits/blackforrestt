#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
function check(name, passed, detail) { checks.push({ name, passed: Boolean(passed), detail }); }

const db = read("src/server/db.ts");
const ledger = read("src/server/ledger.ts");
const hub = read("src/server/engine/hub.ts");
const ws = read("src/server/ws/server.ts");
const register = read("src/app/api/register/route.ts");
const authClient = read("src/lib/authClient.ts");
const providers = read("src/components/providers.tsx");
const kycApi = read("src/app/api/kyc/route.ts");
const kycUi = read("src/components/account/KycDocuments.tsx");
const kycTypes = read("src/lib/kyc.ts");
const adminRoute = read("src/app/api/admin/executions/[id]/route.ts");
const adminUi = read("src/components/admin/AdminWorkspace.tsx");
const accountMenu = read("src/components/account/AccountUserMenu.tsx");
const banner = read("src/components/trade/MarketStatusBanner.tsx");
const production = read("scripts/production/preflight.mjs");
const schema = read("prisma/schema.prisma");

check("retryable serializable transactions", /P2034/.test(db) && /40P01/.test(db) && /withSerializableRetry/.test(hub), "deadlocks and serialization conflicts retry the complete transaction");
check("aborted transaction masking removed", !/set_config\([^\n]+0[^\n]+true/.test(ledger) && /Do not issue a reset query in `finally`/.test(ledger), "SQLSTATE 25P02 is not caused by cleanup inside an aborted transaction");
check("websocket account reads are non-mutating", /readAccountMetrics/.test(ws) && !/recomputeMetrics\(client\.userId\)/.test(ws), "subscriptions cannot contend on wallet projection writes");
check("market projections skip wallet writes", /writeWallet: false/.test(hub) && /options\.writeWallet === false/.test(ledger), "high-frequency floating P&L checkpoints avoid wallet upserts");
check("registration creates unfunded accounts", /ensureUserLedgerAccount/.test(register) && /withSerializableRetry/.test(register) && !/configuredRegistrationStartingBalance|DEMO_FUNDING/.test(register), "new accounts are created retry-safe and unfunded, with no demo funding path");
check("account redirect", /value\.startsWith\("\/trade"\)/.test(authClient) && /return "\/account"/.test(authClient), "login and registration do not default back to the trading terminal");
check("global account synchronization", /subscribeAccount/.test(providers) && /account_snapshot/.test(providers) && /blckforest:realtime/.test(providers), "account and position state is synchronized over the authenticated WebSocket");
check("KYC upload and proof of address", /Upload and verify/.test(kycUi) && /cleanIdentityDocuments/.test(kycApi) === false && /isAddressDocumentType/.test(kycApi) && /UTILITY_BILL/.test(kycTypes) && /BANK_STATEMENT/.test(kycTypes), "identity and proof-of-address files are uploaded, scanned, and validated server-side");
check("admin position controls", /adminPnlAdjustment/.test(schema) && /SET_PROFIT/.test(adminRoute) && /EXECUTION_MANAGE/.test(adminRoute) && /adminClosePosition/.test(hub) && /Set P\/L/.test(adminUi), "dealer P/L correction and forced close require permission and an audited reason");
check("account sign out menu", /signOut/.test(accountMenu) && /Admin console/.test(accountMenu), "account header provides the same operational menu pattern as the terminal");
check("market status banner shows quote source", /marketDataMode/.test(banner) && /Quote source|Market data/.test(banner), "the trade terminal shows the quote source and connection state");
check("production mode is fail closed", /DEV_EMAIL_PREVIEW/.test(production) && /ALLOW_UNVERIFIED_WITHDRAWALS/.test(production) && /NODE_ENV must be production/.test(production), "production startup rejects development-only controls");

const result = { kind: "patch_1_9_source_contract", generatedAt: new Date().toISOString(), root, passed: checks.every((item) => item.passed), checks };
for (const item of checks) console.log(`${item.passed ? "✓" : "✗"} ${item.name}: ${item.detail}`);
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
