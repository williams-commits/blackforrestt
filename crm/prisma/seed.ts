/**
 * CRM seed: RBAC roles, configurable statuses, default pipeline, teams,
 * demo users (one per role), and a small demo dataset so list views and
 * dashboards are meaningful immediately. Idempotent — safe to re-run.
 *
 * Demo credentials (change before any shared environment):
 *   admin@crm.local / manager@crm.local / lead@crm.local / rep@crm.local /
 *   rep2@crm.local / viewer@crm.local — password "ChangeMe123!"
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/server/db";
import { ROLE_DEFINITIONS } from "../src/server/permissions";

const DEMO_PASSWORD = "ChangeMe123!";

async function seedRoles() {
  for (const definition of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { key: definition.key },
      create: {
        key: definition.key,
        name: definition.name,
        description: definition.description,
        isSystem: true,
        scope: definition.scope,
      },
      update: {
        name: definition.name,
        description: definition.description,
        scope: definition.scope,
      },
    });
    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permission: true },
    });
    const have = new Set(existing.map((entry) => entry.permission));
    for (const permission of definition.permissions) {
      if (!have.has(permission)) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permission } });
      }
    }
    // System roles track the code-level permission set exactly.
    const allowed = new Set<string>(definition.permissions);
    for (const entry of existing) {
      if (!allowed.has(entry.permission)) {
        await prisma.rolePermission.delete({
          where: { roleId_permission: { roleId: role.id, permission: entry.permission } },
        });
      }
    }
  }
}

const LEAD_STATUSES = [
  { name: "New", category: "OPEN" as const, sortOrder: 1, isDefault: true },
  { name: "Contacted", category: "OPEN" as const, sortOrder: 2, isDefault: false },
  { name: "Qualified", category: "OPEN" as const, sortOrder: 3, isDefault: false },
  { name: "Converted", category: "CONVERTED" as const, sortOrder: 4, isDefault: false },
  { name: "Lost", category: "LOST" as const, sortOrder: 5, isDefault: false },
  { name: "Invalid", category: "INVALID" as const, sortOrder: 6, isDefault: false },
];

const CONTACT_STATUSES = [
  { name: "Active", category: "OPEN" as const, sortOrder: 1, isDefault: true },
  { name: "Inactive", category: "LOST" as const, sortOrder: 2, isDefault: false },
];

const CUSTOMER_STATUSES = [
  { name: "Onboarding", category: "OPEN" as const, sortOrder: 1, isDefault: true },
  { name: "Active", category: "OPEN" as const, sortOrder: 2, isDefault: false },
  { name: "Churned", category: "LOST" as const, sortOrder: 3, isDefault: false },
];

async function seedStatuses() {
  for (const status of LEAD_STATUSES) {
    await prisma.recordStatus.upsert({
      where: { name_appliesTo: { name: status.name, appliesTo: "LEAD" } },
      create: { ...status, appliesTo: "LEAD" },
      update: { ...status, appliesTo: "LEAD" },
    });
  }
  for (const status of CONTACT_STATUSES) {
    await prisma.recordStatus.upsert({
      where: { name_appliesTo: { name: status.name, appliesTo: "CONTACT" } },
      create: { ...status, appliesTo: "CONTACT" },
      update: { ...status, appliesTo: "CONTACT" },
    });
  }
  for (const status of CUSTOMER_STATUSES) {
    await prisma.recordStatus.upsert({
      where: { name_appliesTo: { name: status.name, appliesTo: "CUSTOMER" } },
      create: { ...status, appliesTo: "CUSTOMER" },
      update: { ...status, appliesTo: "CUSTOMER" },
    });
  }
}

const PIPELINE_STAGES = [
  { name: "New Lead", sortOrder: 1, probability: 10, type: "OPEN" as const },
  { name: "Qualification", sortOrder: 2, probability: 25, type: "OPEN" as const },
  { name: "Discovery", sortOrder: 3, probability: 45, type: "OPEN" as const },
  { name: "Proposal", sortOrder: 4, probability: 65, type: "OPEN" as const },
  { name: "Negotiation", sortOrder: 5, probability: 85, type: "OPEN" as const },
  { name: "Won", sortOrder: 6, probability: 100, type: "WON" as const },
  { name: "Lost", sortOrder: 7, probability: 0, type: "LOST" as const },
];

async function seedPipeline() {
  const pipeline = await prisma.pipeline.upsert({
    where: { name: "Standard Sales" },
    create: { name: "Standard Sales", isDefault: true },
    update: { isDefault: true },
  });
  for (const stage of PIPELINE_STAGES) {
    await prisma.pipelineStage.upsert({
      where: { pipelineId_name: { pipelineId: pipeline.id, name: stage.name } },
      create: { ...stage, pipelineId: pipeline.id },
      update: { ...stage, pipelineId: pipeline.id },
    });
  }
  return pipeline;
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const accounts: Array<{ email: string; name: string; roleKey: string; key: string }> = [
    { email: "admin@crm.local", name: "Ada Admin", roleKey: "SUPER_ADMIN", key: "SUPER_ADMIN" },
    { email: "manager@crm.local", name: "Morgan Manager", roleKey: "MANAGER", key: "MANAGER" },
    { email: "lead@crm.local", name: "Lee Teamlead", roleKey: "TEAM_LEAD", key: "TEAM_LEAD" },
    { email: "rep@crm.local", name: "Riley Rep", roleKey: "REP", key: "REP" },
    { email: "rep2@crm.local", name: "Rowan Rep", roleKey: "REP", key: "REP2" },
    { email: "viewer@crm.local", name: "Vic Viewer", roleKey: "VIEWER", key: "VIEWER" },
  ];
  const users: Record<string, string> = {};
  for (const account of accounts) {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: account.roleKey } });
    const user = await prisma.user.upsert({
      where: { email: account.email },
      create: { email: account.email, name: account.name, roleId: role.id, passwordHash },
      update: { name: account.name, roleId: role.id, passwordHash },
    });
    users[account.key] = user.id;
  }
  return users;
}

async function seedTeams(users: Record<string, string>) {
  const sales = await prisma.team.upsert({
    where: { name: "Sales" },
    create: { name: "Sales", leaderId: users.MANAGER },
    update: { leaderId: users.MANAGER },
  });
  const retention = await prisma.team.upsert({
    where: { name: "Retention" },
    create: { name: "Retention", leaderId: users.TEAM_LEAD },
    update: { leaderId: users.TEAM_LEAD },
  });
  const memberships: Array<{ userId: string; teamId: string }> = [
    { userId: users.MANAGER, teamId: sales.id },
    { userId: users.TEAM_LEAD, teamId: sales.id },
    { userId: users.REP, teamId: sales.id },
    { userId: users.REP2, teamId: sales.id },
    { userId: users.TEAM_LEAD, teamId: retention.id },
  ];
  for (const membership of memberships) {
    await prisma.teamMembership.upsert({
      where: {
        userId_teamId: { userId: membership.userId, teamId: membership.teamId },
      },
      create: membership,
      update: {},
    });
  }
  return { sales, retention };
}

async function seedDemoData(users: Record<string, string>, teamIds: { sales: string; retention: string }) {
  const tagNames = [
    { name: "Hot", color: "#dc2626" },
    { name: "Warm", color: "#f59e0b" },
    { name: "Enterprise", color: "#2563eb" },
    { name: "SMB", color: "#16a34a" },
  ];
  for (const tag of tagNames) {
    await prisma.tag.upsert({ where: { name: tag.name }, create: tag, update: tag });
  }

  const campaign = await prisma.campaign.upsert({
    where: { name: "Q3 Outreach" },
    create: {
      name: "Q3 Outreach",
      description: "Quarterly outbound campaign seeded for demo purposes.",
      source: "OUTBOUND",
      status: "ACTIVE",
      ownerUserId: users.MANAGER,
    },
    update: {},
  });

  const statuses = await prisma.recordStatus.findMany({ where: { appliesTo: "LEAD" } });
  const statusByName = new Map(statuses.map((status) => [status.name, status.id]));

  const leads = [
    { firstName: "Nina", lastName: "Petrova", company: "Baltic Trading Co", email: "nina.petrova@example.com", phone: "+3725012345", country: "EE", source: "WEB_FORM", status: "New", priority: "HIGH" as const, score: 72, assignee: users.REP, tag: "Hot" },
    { firstName: "Carlos", lastName: "Mendes", company: "Mendes & Filhos", email: "carlos@mendesfilhos.example", phone: "+351912345678", country: "PT", source: "REFERRAL", status: "Contacted", priority: "NORMAL" as const, score: 40, assignee: users.REP, tag: "Warm" },
    { firstName: "Aiko", lastName: "Tanaka", company: "Tanaka Holdings", email: "aiko.tanaka@example.jp", phone: "+819012345678", country: "JP", source: "CAMPAIGN", status: "Qualified", priority: "HIGH" as const, score: 85, assignee: users.REP2, tag: "Enterprise" },
    { firstName: "Liam", lastName: "O'Connor", company: null, email: "liam.oconnor@example.ie", phone: "+353861234567", country: "IE", source: "WEB_FORM", status: "New", priority: "LOW" as const, score: 15, assignee: users.REP2, tag: "SMB" },
    { firstName: "Fatima", lastName: "Al-Sayed", company: "Gulf Crescent Capital", email: "fatima@gcc.example", phone: "+971501234567", country: "AE", source: "EVENT", status: "Contacted", priority: "NORMAL" as const, score: 55, assignee: users.REP, tag: "Enterprise" },
    { firstName: "Jonas", lastName: "Weber", company: "Weber GmbH", email: "jonas@weber.example", phone: "+4915112345678", country: "DE", source: "CAMPAIGN", status: "Lost", priority: "NORMAL" as const, score: 20, assignee: users.REP2, tag: "SMB" },
    { firstName: "Priya", lastName: "Sharma", company: "Sharma Analytics", email: "priya@sharma.example", phone: "+919812345678", country: "IN", source: "WEB_FORM", status: "New", priority: "NORMAL" as const, score: 35, assignee: null, tag: null },
    { firstName: "Elena", lastName: "Rossi", company: "Rossi Importi", email: "elena.rossi@example.it", phone: "+393331234567", country: "IT", source: "REFERRAL", status: "Qualified", priority: "HIGH" as const, score: 78, assignee: users.REP, tag: "Hot" },
  ];
  for (const [index, lead] of leads.entries()) {
    await prisma.lead.upsert({
      where: { externalId: `DEMO-LEAD-${String(index + 1).padStart(3, "0")}` },
      create: {
        externalId: `DEMO-LEAD-${String(index + 1).padStart(3, "0")}`,
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
        country: lead.country,
        source: lead.source,
        campaignId: lead.source === "CAMPAIGN" ? campaign.id : null,
        statusId: statusByName.get(lead.status)!,
        priority: lead.priority,
        score: lead.score,
        assignedUserId: lead.assignee,
        assignedTeamId: lead.assignee ? teamIds.sales : null,
      },
      update: {},
    });
  }

  const accountNames = ["Baltic Trading Co", "Tanaka Holdings", "Gulf Crescent Capital", "Rossi Importi", "Sharma Analytics", "Mendes & Filhos"];
  for (const [index, name] of accountNames.entries()) {
    await prisma.account.upsert({
      where: { externalId: `DEMO-ACCOUNT-${index + 1}` },
      create: {
        externalId: `DEMO-ACCOUNT-${index + 1}`,
        name,
        ownerUserId: users.REP,
        teamId: teamIds.sales,
      },
      update: {},
    });
  }
  const accounts = await prisma.account.findMany();
  const accountByName = new Map(accounts.map((account) => [account.name, account]));
  const contactStatuses = await prisma.recordStatus.findMany({ where: { appliesTo: "CONTACT" } });
  const contactStatusId = contactStatuses[0]?.id;

  const demoContacts = [
    { firstName: "Klaus", lastName: "Bergmann", account: "Baltic Trading Co", jobTitle: "Head of Desk", email: "klaus.bergmann@baltic.example" },
    { firstName: "Yuki", lastName: "Sato", account: "Tanaka Holdings", jobTitle: "Procurement", email: "yuki.sato@tanaka.example" },
    { firstName: "Omar", lastName: "Haddad", account: "Gulf Crescent Capital", jobTitle: "Treasury Analyst", email: "omar.haddad@gcc.example" },
    { firstName: "Marco", lastName: "Rossi", account: "Rossi Importi", jobTitle: "Managing Director", email: "marco@rossi.example" },
    { firstName: "Ananya", lastName: "Sharma", account: "Sharma Analytics", jobTitle: "Founder", email: "ananya@sharma.example" },
  ];
  for (const [index, contact] of demoContacts.entries()) {
    await prisma.contact.upsert({
      where: { externalId: `DEMO-CONTACT-${index + 1}` },
      create: {
        externalId: `DEMO-CONTACT-${index + 1}`,
        firstName: contact.firstName,
        lastName: contact.lastName,
        jobTitle: contact.jobTitle,
        email: contact.email,
        accountId: accountByName.get(contact.account)?.id ?? null,
        statusId: contactStatusId ?? null,
        ownerUserId: users.REP,
      },
      update: {},
    });
  }

  const customerStatuses = await prisma.recordStatus.findMany({ where: { appliesTo: "CUSTOMER" } });
  const customerStatusId = customerStatuses.find((status) => status.name === "Active")?.id ?? customerStatuses[0]?.id;
  const demoCustomers = [
    { firstName: "Klaus", lastName: "Bergmann", contact: "DEMO-CONTACT-1", email: "klaus.bergmann@baltic.example", owner: "REP" },
    { firstName: "Ananya", lastName: "Sharma", contact: "DEMO-CONTACT-5", email: "ananya@sharma.example", owner: "REP2" },
  ];
  for (const [index, customer] of demoCustomers.entries()) {
    const contact = await prisma.contact.findUnique({ where: { externalId: customer.contact } });
    await prisma.customer.upsert({
      where: { id: `democus${index + 1}seed` },
      create: {
        id: `democus${index + 1}seed`,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        contactId: contact?.id ?? null,
        statusId: customerStatusId ?? null,
        source: "CONVERSION",
        ownerUserId: customer.owner === "REP2" ? users.REP2 : users.REP,
        teamId: teamIds.sales,
      },
      update: {},
    });
  }

  const pipeline = await prisma.pipeline.findUniqueOrThrow({ where: { name: "Standard Sales" } });
  const stages = await prisma.pipelineStage.findMany({ where: { pipelineId: pipeline.id } });
  const stageByName = new Map(stages.map((stage) => [stage.name, stage]));

  const opportunities = [
    { name: "Baltic Trading — platform onboarding", account: 0, stage: "Proposal", value: 4_500_00, probability: 65 },
    { name: "Tanaka Holdings — multi-desk rollout", account: 1, stage: "Discovery", value: 18_000_00, probability: 45 },
    { name: "Gulf Crescent — treasury mandate", account: 2, stage: "Qualification", value: 32_000_00, probability: 25 },
    { name: "Rossi Importi — starter package", account: 3, stage: "Negotiation", value: 2_200_00, probability: 85 },
    { name: "Sharma Analytics — pilot", account: 4, stage: "Won", value: 900_00, probability: 100 },
  ];
  for (const [index, opportunity] of opportunities.entries()) {
    const stage = stageByName.get(opportunity.stage)!;
    const seedId = `demoopp${index + 1}seed`;
    await prisma.opportunity.upsert({
      where: { id: seedId },
      create: {
        id: seedId,
        name: opportunity.name,
        accountId: accounts[opportunity.account]?.id ?? null,
        ownerUserId: users.REP,
        teamId: teamIds.sales,
        pipelineId: pipeline.id,
        stageId: stage.id,
        value: BigInt(opportunity.value),
        probability: opportunity.probability,
        status: stage.type === "OPEN" ? "OPEN" : stage.type === "WON" ? "WON" : "LOST",
      },
      update: { teamId: teamIds.sales },
    });
  }

  const demoLeads = await prisma.lead.findMany({ where: { externalId: { startsWith: "DEMO-LEAD" } }, take: 3 });
  for (const [index, lead] of demoLeads.entries()) {
    const taskSeedId = `demotask${index + 1}seed`;
    const dueOffsets = [-2, 0, 5]; // one overdue, one due today, one upcoming
    await prisma.task.upsert({
      where: { id: taskSeedId },
      create: {
        id: taskSeedId,
        title: `Follow up with ${lead.firstName} ${lead.lastName}`,
        ownerUserId: users.REP,
        dueAt: new Date(Date.now() + dueOffsets[index] * 24 * 60 * 60 * 1000),
        priority: index === 0 ? "HIGH" : "NORMAL",
        subjectType: "LEAD",
        subjectId: lead.id,
      },
      update: {},
    });
    const existingNotes = await prisma.note.count({
      where: { subjectType: "LEAD", subjectId: lead.id },
    });
    if (existingNotes === 0) {
      await prisma.note.create({
        data: {
          body: `Introductory call completed with ${lead.firstName}. ${lead.company ? `Interested in ${lead.company} use cases.` : "Independent trader."}`,
          authorUserId: users.REP,
          subjectType: "LEAD",
          subjectId: lead.id,
        },
      });
    }
  }
  if (demoLeads[0]) {
    const apptSeedId = "demoappt1seed";
    await prisma.appointment.upsert({
      where: { id: apptSeedId },
      create: {
        id: apptSeedId,
        title: `Discovery call — ${demoLeads[0].firstName} ${demoLeads[0].lastName}`,
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        ownerUserId: users.REP,
        subjectType: "LEAD",
        subjectId: demoLeads[0].id,
      },
      update: {},
    });
  }
}

async function main() {
  console.log("Seeding CRM…");
  await seedRoles();
  await seedStatuses();
  await seedPipeline();
  const users = await seedUsers();
  const teams = await seedTeams(users);
  await seedDemoData(users, { sales: teams.sales.id, retention: teams.retention.id });
  await prisma.systemSetting.upsert({
    where: { key: "org.currency" },
    create: { key: "org.currency", value: "USD", updatedById: users.SUPER_ADMIN },
    update: { updatedById: users.SUPER_ADMIN },
  });
  console.log("CRM seed complete.");
}

main()
  .catch((error) => {
    console.error("CRM seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
