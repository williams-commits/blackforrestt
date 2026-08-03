import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const failures = [];
const check = (name, condition, detail) => {
  if (condition) console.log(`✓ ${name}`);
  else { console.error(`✗ ${name}: ${detail}`); failures.push(name); }
};

const adminUi = read("src/components/admin/AdminWorkspace.tsx");
const paymentsUi = read("src/components/admin/PaymentsReview.tsx");
const promptUi = read("src/components/ui/useCommandDialog.tsx");
const route = read("src/app/api/admin/users/[id]/finance/route.ts");
const service = read("src/server/adminBalance.ts");
const policy = read("src/server/adminPolicy.ts");
const register = read("src/app/api/register/route.ts");
const envExample = read(".env.example");
const compose = read("docker-compose.yml");

const sourceFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) sourceFiles.push(absolute);
  }
}
walk(path.join(root, "src"));
const browserSource = sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");

check("native browser prompts removed", !/window\.(?:prompt|confirm|alert)\s*\(/.test(browserSource), "window.prompt/window.confirm/window.alert remains in application source");
check("accessible command modal exists", /Promise-based, accessible replacement/.test(promptUi) && /role="alert"/.test(promptUi), "custom command dialog is missing accessibility or validation behavior");
check("admin balance permission is explicit", /USER_BALANCE_ADJUST/.test(policy) && /FINANCE:[\s\S]*USER_BALANCE_ADJUST/.test(policy), "finance role lacks explicit balance-adjustment permission");
check("balance API is permission gated", /requireAdmin\("USER_BALANCE_ADJUST"\)/.test(route), "finance route lacks authorization");
check("balance posting is double-entry", /ADMIN_ADJUSTMENT/.test(service) && /ADJUSTMENT_EQUITY/.test(service) && /postLedgerTransaction/.test(service), "balance changes bypass the ledger");
check("deductions cannot overspend", /balances\.available\.lessThan\(amount\)/.test(service), "deductions do not enforce available funds");
check("balance commands are replay safe", /existingPosting/.test(service) && /posted\.replayed/.test(service) && /userId_reference/.test(service), "idempotency/replay handling is incomplete");
check("balance updates broadcast", /publishAccountMetrics/.test(route), "customer real-time account state is not refreshed");
check("user transaction history is exposed", /Customer transaction history/.test(adminUi) && /getUserFinanceHistory/.test(route), "admin finance history UI/API is missing");
check("payment prompts use custom modal", /useCommandDialog/.test(paymentsUi) && !/window\.prompt/.test(paymentsUi), "payment review still uses a native prompt");
check("registration creates unfunded accounts", /ensureUserLedgerAccount/.test(register) && !/configuredRegistrationStartingBalance|DEMO_FUNDING/.test(register), "registration no longer posts demo funding; new accounts start unfunded");
check("no registration funding default", !/REGISTRATION_STARTING_BALANCE/.test(envExample) && !/REGISTRATION_STARTING_BALANCE/.test(compose), "the demo funding environment variable has been removed");

if (failures.length) {
  console.error(`\n${failures.length} admin-balance feature check(s) failed.`);
  process.exit(1);
}
console.log("\nAdmin balance and command-dialog source verification passed.");
