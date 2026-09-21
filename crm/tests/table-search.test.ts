import test from "node:test";
import assert from "node:assert/strict";
import { adminContext } from "./helpers";
import { listLeads } from "../src/server/records/leads";
import { listContacts } from "../src/server/records/contacts";
import { listAccounts } from "../src/server/records/accounts";
import { listCustomers } from "../src/server/records/customers";
import { listOpportunities } from "../src/server/records/opportunities";
import { listCampaignsPage } from "../src/server/records/campaigns";
import { pgSearch } from "../src/server/search/pg";

/**
 * Table-search coverage: q must hit EVERY text column of an object, not
 * just names. Asserted against the deterministic seed (npm run db:seed):
 * leads carry source/country values, contacts/accounts carry DEMO-*
 * external IDs, customers carry source "CONVERSION", opportunities
 * default to USD. Admin context (ORG scope) sees every seeded row.
 */

test("lead search matches source and country, not just name/email", async () => {
  const admin = await adminContext();
  const bySource = await listLeads(admin, { page: 1, pageSize: 25, q: "REFERRAL" }, { assignment: "all" });
  assert.ok(bySource.total >= 1, "q=REFERRAL finds leads by source");
  assert.ok(bySource.rows.some((row) => row.source === "REFERRAL"));

  const byCountry = await listLeads(admin, { page: 1, pageSize: 25, q: "EE" }, { assignment: "all" });
  assert.ok(byCountry.total >= 1, "q=EE finds leads by country");
  assert.ok(byCountry.rows.some((row) => row.country === "EE"), "the Estonia (EE) lead is among the matches");
});

test("contact search matches externalId", async () => {
  const admin = await adminContext();
  const byExternalId = await listContacts(admin, { page: 1, pageSize: 25, q: "DEMO-CONTACT" }, {});
  assert.ok(byExternalId.total >= 1, "q=DEMO-CONTACT finds contacts by externalId");
  assert.ok(byExternalId.rows.every((row) => row.externalId?.startsWith("DEMO-CONTACT")));
});

test("account search matches externalId", async () => {
  const admin = await adminContext();
  const byExternalId = await listAccounts(admin, { page: 1, pageSize: 25, q: "DEMO-ACCOUNT" }, {});
  assert.ok(byExternalId.total >= 1, "q=DEMO-ACCOUNT finds accounts by externalId");
  assert.ok(byExternalId.rows.every((row) => row.externalId?.startsWith("DEMO-ACCOUNT")));
});

test("customer search matches source", async () => {
  const admin = await adminContext();
  const bySource = await listCustomers(admin, { page: 1, pageSize: 25, q: "CONVERSION" }, {});
  assert.ok(bySource.total >= 1, "q=CONVERSION finds customers by source");
});

test("opportunity search matches currency", async () => {
  const admin = await adminContext();
  const byCurrency = await listOpportunities(admin, { page: 1, pageSize: 25, q: "USD" }, {});
  assert.ok(byCurrency.total >= 1, "q=USD finds opportunities by currency");
});

test("lead search matches the status NAME (relation column)", async () => {
  const admin = await adminContext();
  // "Qualified" appears in no seeded lead scalar field — only as a status name.
  const byStatus = await listLeads(admin, { page: 1, pageSize: 100, q: "Qualified" }, { assignment: "all" });
  assert.ok(
    byStatus.rows.some((row) => row.status?.name === "Qualified"),
    "q=Qualified finds leads through the status relation",
  );
});

test("contact search matches the account NAME (relation column)", async () => {
  const admin = await adminContext();
  const byAccount = await listContacts(admin, { page: 1, pageSize: 25, q: "Baltic" }, {});
  assert.ok(
    byAccount.rows.some((row) => row.account?.name === "Baltic Trading Co"),
    "q=Baltic finds contacts through the account relation",
  );
});

test("campaign list supports search + pagination", async () => {
  const admin = await adminContext();
  const page1 = await listCampaignsPage(admin, { page: 1, pageSize: 1, q: "Outreach" });
  assert.ok(page1.total >= 1, "seeded Q3 Outreach campaign is searchable");
  assert.equal(page1.rows.length, 1, "pageSize is respected");
  assert.equal(page1.rows[0]!.name, "Q3 Outreach");
});

test("global search covers relation columns and campaigns", async () => {
  const admin = await adminContext();
  const statusHits = await pgSearch.search(admin, "Qualified", 5);
  assert.ok(statusHits.some((hit) => hit.objectType === "LEAD"), "status-name match returns lead hits");
  const campaignHits = await pgSearch.search(admin, "Q3 Outreach", 5);
  assert.ok(
    campaignHits.some((hit) => hit.objectType === "CAMPAIGN" && hit.url === "/campaigns"),
    "campaigns are searchable globally",
  );
});

test("sort order param flips the direction (asc vs desc)", async () => {
  const admin = await adminContext();
  const base = { page: 1, pageSize: 100, sort: "name" };
  const asc = await listLeads(admin, { ...base, order: "asc" }, { assignment: "all" });
  const desc = await listLeads(admin, { ...base, order: "desc" }, { assignment: "all" });
  assert.ok(asc.rows.length >= 2, "seed has at least two leads");
  assert.equal(asc.rows.length, desc.rows.length, "same result set both directions");
  assert.notDeepEqual(
    asc.rows.map((row) => row.lastName),
    desc.rows.map((row) => row.lastName),
    "order changes the sort",
  );
  // Collation-agnostic direction proof: whatever order the database chose
  // for asc, desc must be its exact mirror (ties here are identical
  // strings, so reversal is stable).
  assert.deepEqual(
    asc.rows.map((row) => row.lastName),
    [...desc.rows.map((row) => row.lastName)].reverse(),
    "descending is the exact reverse of ascending",
  );
});
