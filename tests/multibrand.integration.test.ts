import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

// Pin the multi-brand environment so a developer's local .env cannot change
// what these tests assert. Wallet addresses are structurally valid fakes
// (validator-checked formats, never real payment destinations).
const BRAND_TRON = `TBrand2Test${randomBase58(23)}`;
const BRAND_BTC = `bc1brand2test${randomHexLower(39)}`;
const GLOBAL_TRON = `TG1oba1Test${randomBase58(23)}`;
const BRAND_WALLETS = `USDT:TRON (TRC20):${BRAND_TRON}; BTC:Bitcoin:${BRAND_BTC}`;
process.env.BRAND_DOMAINS = "blackforrestt.com,gbfxs.com";
process.env.BRAND_DOMAIN = "blackforrestt.com";
// Manifest-driven model: no numbered slots. gbfxs routing comes from
// src/domains/gbfxs/domain.config.ts; only identity/wallet overrides in env.
process.env.BRAND_OVERRIDES = JSON.stringify({
  "gbfxs.com": { name: "Global Forex Services", depositWallets: BRAND_WALLETS },
});
process.env.DEPOSIT_WALLET_ADDRESSES = `USDT:TRON (TRC20):${GLOBAL_TRON}`;

const prisma = new PrismaClient();

function randomBase58(length: number): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function randomHexLower(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += "0123456789abcdefghijkmnopqrstuvwxyz"[Math.floor(Math.random() * 33)];
  return out;
}

// Guard the fakes against future edits breaking the validator's formats.
assert.match(BRAND_TRON, /^T[1-9A-HJ-NP-Za-km-z]{33}$/);
assert.match(GLOBAL_TRON, /^T[1-9A-HJ-NP-Za-km-z]{33}$/);
assert.match(BRAND_BTC, /^bc1[a-z0-9]{39,59}$/);

test("deposit wallets resolve per brand family (global → brand → group)", async () => {
  const { resolveUserSettings } = await import("../src/server/userSettings.js");
  const suffix = randomUUID().slice(0, 8);
  const [primary, gbfxs, grouped] = await Promise.all([
    prisma.user.create({ data: { email: `mb-p-${suffix}@example.invalid`, accountNo: `p${suffix}` } }),
    prisma.user.create({ data: { email: `mb-a-${suffix}@example.invalid`, accountNo: `a${suffix}`, brandDomain: "gbfxs.com" } }),
    prisma.user.create({ data: { email: `mb-g-${suffix}@example.invalid`, accountNo: `g${suffix}`, brandDomain: "gbfxs.com" } }),
  ]);

  // Primary users keep the global list.
  const primarySettings = await resolveUserSettings(primary.id);
  assert.equal(primarySettings.deposits.walletAddresses.length, 1);
  assert.equal(primarySettings.deposits.walletAddresses[0]!.address, GLOBAL_TRON);

  // gbfxs-family users get the BRAND wallets instead.
  const gbfxsSettings = await resolveUserSettings(gbfxs.id);
  assert.equal(gbfxsSettings.deposits.walletAddresses.length, 2);
  assert.ok(gbfxsSettings.deposits.walletAddresses.some((w) => w.asset === "USDT" && w.address === BRAND_TRON));
  assert.ok(gbfxsSettings.deposits.walletAddresses.some((w) => w.asset === "BTC" && w.address === BRAND_BTC));

  // A group override still beats the brand layer.
  const group = await prisma.userGroup.create({
    data: {
      name: `mb-group-${suffix}`,
      settings: { deposits: { walletAddresses: [{ asset: "USDT", network: "TRON (TRC20)", address: `T${randomBase58(33)}` }] } },
    },
  });
  await prisma.userGroupMembership.create({ data: { userId: grouped.id, groupId: group.id } });
  const groupedSettings = await resolveUserSettings(grouped.id);
  assert.equal(groupedSettings.deposits.walletAddresses.length, 1);
  assert.ok(groupedSettings.deposits.walletAddresses[0]!.address.startsWith("T"));
  assert.notEqual(groupedSettings.deposits.walletAddresses[0]!.address, gbfxsSettings.deposits.walletAddresses.find((w) => w.asset === "USDT")!.address);

  await prisma.user.delete({ where: { id: primary.id } });
  await prisma.user.delete({ where: { id: gbfxs.id } });
  await prisma.user.delete({ where: { id: grouped.id } });
  await prisma.userGroup.delete({ where: { id: group.id } });
});

test("referral links stay in the referrer's brand family", async () => {
  const { getReferralStats } = await import("../src/server/referrals.js");
  const suffix = randomUUID().slice(0, 8);
  const [primary, gbfxs] = await Promise.all([
    prisma.user.create({ data: { email: `mb-rp-${suffix}@example.invalid`, accountNo: `rp${suffix}` } }),
    prisma.user.create({ data: { email: `mb-ra-${suffix}@example.invalid`, accountNo: `ra${suffix}`, brandDomain: "gbfxs.com" } }),
  ]);

  const gbfxsStats = await getReferralStats(gbfxs.id);
  assert.match(gbfxsStats.link, /^trade\.gbfxs\.com\/register\?ref=/);

  const primaryStats = await getReferralStats(primary.id);
  assert.match(primaryStats.link, /^trade\.blackforrestt\.com\/register\?ref=/);

  // Legacy accounts (no stored brandDomain — created before multi-brand
  // signups) get the REQUESTING family when the API passes it as fallback.
  const legacy = await prisma.user.create({ data: { email: `mb-legacy-${suffix}@example.invalid`, accountNo: `lg${suffix}` } });
  assert.match((await getReferralStats(legacy.id, "gbfxs.com")).link, /^trade\.gbfxs\.com\/register\?ref=/);
  assert.match((await getReferralStats(legacy.id)).link, /^trade\.blackforrestt\.com\/register\?ref=/);
  await prisma.user.delete({ where: { id: legacy.id } });

  await prisma.user.delete({ where: { id: primary.id } });
  await prisma.user.delete({ where: { id: gbfxs.id } });
});

test("tradeHostForDomain follows deployment pairs, then tradeEnabled, then canonical", async () => {
  const { tradeHostForDomain, brandProfileForDomain } = await import("../src/lib/branding.js");

  // Deployment DOMAIN/TRADE_DOMAIN pairs win.
  assert.equal(tradeHostForDomain("gbfxs.com"), "trade.gbfxs.com");
  assert.equal(tradeHostForDomain("blackforrestt.com"), "trade.blackforrestt.com");
  assert.equal(tradeHostForDomain(null), "trade.blackforrestt.com");
  assert.equal(tradeHostForDomain("unknown.example"), "trade.blackforrestt.com");

  // The brand profile carries the per-family deposit wallet config.
  const agileProfile = brandProfileForDomain("gbfxs.com");
  assert.equal(agileProfile.depositWallets, BRAND_WALLETS);
  assert.equal(brandProfileForDomain("blackforrestt.com").depositWallets, "");

  // tradeEnabled via an EXISTING override entry (entry-authority: an absent
  // flag inside an entry means NOT enabled — the manifest default is ignored).
  const savedOverrides = process.env.BRAND_OVERRIDES;
  process.env.BRAND_OVERRIDES = JSON.stringify({ "gbfxs.com": { tradeEnabled: true } });
  assert.equal(tradeHostForDomain("gbfxs.com"), "trade.gbfxs.com");
  process.env.BRAND_OVERRIDES = JSON.stringify({ "gbfxs.com": {} });
  // An entry WITHOUT the flag falls through to the manifest (tradeEnabled=true).
  assert.equal(tradeHostForDomain("gbfxs.com"), "trade.gbfxs.com");
  // An entry that EXPLICITLY disables the family's trade host:
  process.env.BRAND_OVERRIDES = JSON.stringify({ "gbfxs.com": { tradeEnabled: false } });
  assert.equal(tradeHostForDomain("gbfxs.com"), "trade.blackforrestt.com");
  // With NO entry at all, the manifest default (gbfxs tradeEnabled=true) wins.
  process.env.BRAND_OVERRIDES = "";
  assert.equal(tradeHostForDomain("gbfxs.com"), "trade.gbfxs.com");
  process.env.BRAND_OVERRIDES = savedOverrides;
});

test("shared support inbox reports each customer's brand family", async () => {
  const { sendDirectMessage, adminMessageThreads } = await import("../src/server/adminUserManagement.js");
  const suffix = randomUUID().slice(0, 8);
  const [admin, agileCustomer] = await Promise.all([
    prisma.user.create({ data: { email: `mb-admin-${suffix}@example.invalid`, accountNo: `ad${suffix}`, isAdmin: true } }),
    prisma.user.create({ data: { email: `mb-cust-${suffix}@example.invalid`, accountNo: `cu${suffix}`, brandDomain: "gbfxs.com" } }),
  ]);

  await sendDirectMessage({ senderId: agileCustomer.id, recipientId: admin.id, body: "Which brand is this?", notify: false });
  const { threads } = await adminMessageThreads();
  const thread = threads.find((t) => t.userId === agileCustomer.id);
  assert.ok(thread, "expected a thread for the gbfxs customer");
  assert.equal(thread.brandDomain, "gbfxs.com");

  await prisma.user.delete({ where: { id: admin.id } });
  await prisma.user.delete({ where: { id: agileCustomer.id } });
});

test.after(async () => {
  await prisma.$disconnect();
});
