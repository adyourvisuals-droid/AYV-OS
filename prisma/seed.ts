import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_ORG_SLUG = "adyourvisuals";
const DEMO_PASSWORD = "password123";

async function main() {
  const existing = await prisma.organization.findUnique({ where: { slug: DEMO_ORG_SLUG } });
  if (existing) {
    console.log(`Organization "${DEMO_ORG_SLUG}" already exists — skipping seed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const [owner, rep1, rep2] = await Promise.all([
    prisma.user.create({
      data: { name: "Amina Yusuf", email: "adyourvisuals@gmail.com", passwordHash },
    }),
    prisma.user.create({
      data: { name: "Daniel Cruz", email: "daniel@adyourvisuals.demo", passwordHash },
    }),
    prisma.user.create({
      data: { name: "Priya Nair", email: "priya@adyourvisuals.demo", passwordHash },
    }),
  ]);

  const organization = await prisma.organization.create({
    data: {
      name: "AdYourVisuals",
      slug: DEMO_ORG_SLUG,
      memberships: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: rep1.id, role: "MEMBER" },
          { userId: rep2.id, role: "MEMBER" },
        ],
      },
    },
  });
  const orgId = organization.id;

  const stageDefs = [
    { name: "New", order: 0, probability: 10 },
    { name: "Qualified", order: 1, probability: 25 },
    { name: "Proposal Sent", order: 2, probability: 50 },
    { name: "Negotiation", order: 3, probability: 75 },
    { name: "Won", order: 4, probability: 100, isWon: true },
    { name: "Lost", order: 5, probability: 0, isLost: true },
  ];
  await prisma.pipelineStage.createMany({
    data: stageDefs.map((s) => ({ organizationId: orgId, ...s })),
  });
  const stages = await prisma.pipelineStage.findMany({
    where: { organizationId: orgId },
    orderBy: { order: "asc" },
  });
  const stageByName = Object.fromEntries(stages.map((s) => [s.name, s]));

  const companies = await Promise.all(
    [
      { name: "Northwind Retail", domain: "northwindretail.com", industry: "Retail", size: "51-200", city: "Austin", country: "USA" },
      { name: "Bluepeak Fitness", domain: "bluepeakfitness.com", industry: "Health & Wellness", size: "11-50", city: "Denver", country: "USA" },
      { name: "Orbit Real Estate", domain: "orbitrealestate.io", industry: "Real Estate", size: "11-50", city: "Miami", country: "USA" },
      { name: "Solace Skincare", domain: "solaceskincare.com", industry: "Beauty & Cosmetics", size: "1-10", city: "Los Angeles", country: "USA" },
    ].map((c) => prisma.company.create({ data: { organizationId: orgId, ownerId: rep1.id, ...c } }))
  );

  const contacts = await Promise.all(
    [
      { firstName: "Sarah", lastName: "Kim", email: "sarah.kim@northwindretail.com", phone: "+1-512-555-0110", title: "Marketing Director", companyId: companies[0].id },
      { firstName: "Marcus", lastName: "Ellis", email: "marcus@bluepeakfitness.com", phone: "+1-303-555-0122", title: "Founder", companyId: companies[1].id },
      { firstName: "Renee", lastName: "Alvarez", email: "renee@orbitrealestate.io", phone: "+1-305-555-0134", title: "Head of Growth", companyId: companies[2].id },
      { firstName: "Jae", lastName: "Park", email: "jae@solaceskincare.com", phone: "+1-213-555-0145", title: "Owner", companyId: companies[3].id },
      { firstName: "Louis", lastName: "Bennett", email: "louis.bennett@gmail.com", phone: "+1-646-555-0199", title: "Independent Consultant", companyId: null },
    ].map((c) =>
      prisma.contact.create({ data: { organizationId: orgId, ownerId: rep2.id, whatsapp: c.phone, ...c } })
    )
  );

  await prisma.leadScoringRule.createMany({
    data: [
      { organizationId: orgId, name: "Website source", field: "source", operator: "EQUALS", value: "WEBSITE", points: 10 },
      { organizationId: orgId, name: "Referral source", field: "source", operator: "EQUALS", value: "REFERRAL", points: 20 },
      { organizationId: orgId, name: "Has budget set", field: "budget", operator: "IS_SET", points: 15 },
      { organizationId: orgId, name: "Has email", field: "email", operator: "IS_SET", points: 5 },
      { organizationId: orgId, name: "Qualified status", field: "status", operator: "EQUALS", value: "QUALIFIED", points: 25 },
    ],
  });

  const leadDefs = [
    { name: "GreenLeaf Cafe", email: "hello@greenleafcafe.com", source: "WEBSITE", status: "NEW", budget: 2500, ownerId: rep1.id },
    { name: "Vantage Law Group", email: "info@vantagelaw.com", source: "REFERRAL", status: "CONTACTED", budget: 8000, ownerId: rep1.id },
    { name: "Pulse Audio Studio", email: "bookings@pulseaudio.io", source: "SOCIAL_MEDIA", status: "QUALIFIED", budget: 4200, ownerId: rep2.id },
    { name: "Everline Logistics", email: "sales@everline.com", source: "COLD_OUTREACH", status: "NEW", ownerId: rep2.id },
    { name: "Harbor & Co Realty", email: "team@harborco.com", source: "EVENT", status: "UNQUALIFIED", budget: 1200, ownerId: rep1.id },
    { name: "Solstice Yoga", whatsapp: "+1-720-555-0166", source: "WHATSAPP", status: "CONTACTED", budget: 3000, ownerId: rep2.id },
    { name: "Ironclad Fitness Gear", email: "partnerships@ironcladgear.com", source: "ADVERTISEMENT", status: "QUALIFIED", budget: 6000, ownerId: rep1.id },
  ] as const;

  const leads = [];
  for (const def of leadDefs) {
    const lead = await prisma.lead.create({ data: { organizationId: orgId, ...def } });
    leads.push(lead);
  }

  // Recompute scores using the same rule set the app uses at runtime.
  const rules = await prisma.leadScoringRule.findMany({ where: { organizationId: orgId, isActive: true } });
  for (const lead of leads) {
    const score = rules.reduce((total, rule) => {
      const value =
        rule.field === "source"
          ? lead.source
          : rule.field === "status"
            ? lead.status
            : rule.field === "budget"
              ? (lead.budget != null ? String(lead.budget) : null)
              : rule.field === "email"
                ? lead.email
                : null;
      const matched =
        rule.operator === "IS_SET"
          ? value != null && value !== ""
          : rule.operator === "EQUALS"
            ? value === rule.value
            : false;
      return matched ? total + rule.points : total;
    }, 0);
    await prisma.lead.update({ where: { id: lead.id }, data: { score } });
  }

  const deals = await Promise.all([
    prisma.deal.create({
      data: {
        organizationId: orgId,
        title: "Northwind Retail — Brand Refresh",
        value: 12000,
        stageId: stageByName["Proposal Sent"].id,
        probability: stageByName["Proposal Sent"].probability,
        companyId: companies[0].id,
        contactId: contacts[0].id,
        ownerId: rep1.id,
        expectedCloseDate: new Date(Date.now() + 14 * 86400000),
      },
    }),
    prisma.deal.create({
      data: {
        organizationId: orgId,
        title: "Bluepeak Fitness — Social Ad Campaign",
        value: 6500,
        stageId: stageByName["Negotiation"].id,
        probability: stageByName["Negotiation"].probability,
        companyId: companies[1].id,
        contactId: contacts[1].id,
        ownerId: rep2.id,
        expectedCloseDate: new Date(Date.now() + 7 * 86400000),
      },
    }),
    prisma.deal.create({
      data: {
        organizationId: orgId,
        title: "Orbit Real Estate — Listing Video Package",
        value: 9800,
        stageId: stageByName["Qualified"].id,
        probability: stageByName["Qualified"].probability,
        companyId: companies[2].id,
        contactId: contacts[2].id,
        ownerId: rep1.id,
      },
    }),
    prisma.deal.create({
      data: {
        organizationId: orgId,
        title: "Solace Skincare — Full Rebrand",
        value: 18500,
        stageId: stageByName["Won"].id,
        status: "WON",
        probability: 100,
        closedAt: new Date(Date.now() - 3 * 86400000),
        companyId: companies[3].id,
        contactId: contacts[3].id,
        ownerId: rep2.id,
      },
    }),
    prisma.deal.create({
      data: {
        organizationId: orgId,
        title: "Louis Bennett — Personal Brand Package",
        value: 3200,
        stageId: stageByName["New"].id,
        probability: stageByName["New"].probability,
        contactId: contacts[4].id,
        ownerId: rep2.id,
      },
    }),
    prisma.deal.create({
      data: {
        organizationId: orgId,
        title: "Everline Logistics — Website Overhaul",
        value: 5400,
        stageId: stageByName["Lost"].id,
        status: "LOST",
        probability: 0,
        closedAt: new Date(Date.now() - 10 * 86400000),
        lostReason: "Went with an in-house team",
        ownerId: rep1.id,
      },
    }),
  ]);

  await prisma.activity.createMany({
    data: [
      {
        organizationId: orgId,
        type: "NOTE",
        subject: "Kickoff call recap",
        body: "Client wants a bold, modern look — avoid pastel palettes.",
        dealId: deals[0].id,
        createdById: rep1.id,
      },
      {
        organizationId: orgId,
        type: "TASK",
        subject: "Send revised brand guidelines",
        status: "OPEN",
        dueDate: new Date(Date.now() + 2 * 86400000),
        dealId: deals[0].id,
        assignedToId: rep1.id,
        createdById: rep1.id,
      },
      {
        organizationId: orgId,
        type: "TASK",
        subject: "Follow up on contract redlines",
        status: "OPEN",
        dueDate: new Date(Date.now() - 1 * 86400000),
        dealId: deals[1].id,
        assignedToId: rep2.id,
        createdById: rep2.id,
      },
      {
        organizationId: orgId,
        type: "MEETING",
        subject: "Discovery call",
        location: "Google Meet",
        startTime: new Date(Date.now() + 3 * 86400000),
        endTime: new Date(Date.now() + 3 * 86400000 + 30 * 60000),
        leadId: leads[2].id,
        assignedToId: rep2.id,
        createdById: rep2.id,
      },
      {
        organizationId: orgId,
        type: "CALL",
        subject: "Intro call with Renee",
        direction: "OUTBOUND",
        duration: 620,
        outcome: "CONNECTED",
        toAddress: contacts[2].phone ?? undefined,
        dealId: deals[2].id,
        createdById: rep1.id,
      },
      {
        organizationId: orgId,
        type: "FOLLOW_UP",
        subject: "Check in after proposal review",
        dueDate: new Date(Date.now() + 5 * 86400000),
        dealId: deals[0].id,
        assignedToId: rep1.id,
        createdById: rep1.id,
      },
      {
        organizationId: orgId,
        type: "EMAIL",
        subject: "Proposal sent",
        direction: "OUTBOUND",
        fromAddress: "hello@adyourvisuals.demo",
        toAddress: contacts[0].email ?? undefined,
        body: "Hi Sarah, attached is the brand refresh proposal we discussed.",
        dealId: deals[0].id,
        createdById: rep1.id,
      },
      {
        organizationId: orgId,
        type: "WHATSAPP",
        subject: "Quick check-in",
        direction: "INBOUND",
        fromAddress: "+1-720-555-0166",
        body: "Hey! Just following up on the campaign timeline 🙂",
        leadId: leads[5].id,
        createdById: rep2.id,
      },
    ],
  });

  const proposal = await prisma.proposal.create({
    data: {
      organizationId: orgId,
      number: "PRO-" + new Date().getFullYear() + "-0001",
      title: "Northwind Retail — Brand Refresh Proposal",
      dealId: deals[0].id,
      companyId: companies[0].id,
      contactId: contacts[0].id,
      status: "SENT",
      summary: "A full brand refresh including new visual identity, style guide, and launch assets.",
      currency: "USD",
      totalAmount: 12000,
      sentAt: new Date(),
      validUntil: new Date(Date.now() + 21 * 86400000),
      items: {
        create: [
          { name: "Brand strategy workshop", quantity: 1, unitPrice: 2000, order: 0 },
          { name: "Visual identity design", quantity: 1, unitPrice: 6000, order: 1 },
          { name: "Brand guideline document", quantity: 1, unitPrice: 2500, order: 2 },
          { name: "Launch asset pack", quantity: 1, unitPrice: 1500, order: 3 },
        ],
      },
    },
  });

  const quotation = await prisma.quotation.create({
    data: {
      organizationId: orgId,
      number: "QUO-" + new Date().getFullYear() + "-0001",
      title: "Bluepeak Fitness — Social Ad Campaign Quote",
      dealId: deals[1].id,
      companyId: companies[1].id,
      contactId: contacts[1].id,
      status: "SENT",
      currency: "USD",
      taxPercent: 8.25,
      totalAmount: 6500 * 1.0825,
      sentAt: new Date(),
      items: {
        create: [
          { name: "Ad creative production (x10)", quantity: 10, unitPrice: 300, order: 0 },
          { name: "Campaign management (monthly)", quantity: 1, unitPrice: 2500, order: 1 },
          { name: "Performance reporting", quantity: 1, unitPrice: 1000, order: 2 },
        ],
      },
    },
  });

  const contract = await prisma.contract.create({
    data: {
      organizationId: orgId,
      number: "CON-" + new Date().getFullYear() + "-0001",
      title: "Solace Skincare — Rebrand Agreement",
      dealId: deals[3].id,
      companyId: companies[3].id,
      contactId: contacts[3].id,
      status: "SIGNED",
      value: 18500,
      currency: "USD",
      startDate: new Date(Date.now() - 20 * 86400000),
      endDate: new Date(Date.now() + 70 * 86400000),
      signedAt: new Date(Date.now() - 3 * 86400000),
      content:
        "Scope: full brand identity redesign, packaging refresh, and e-commerce site relaunch. Payment: 50% upfront, 50% on delivery.",
    },
  });

  await prisma.automationRule.createMany({
    data: [
      {
        organizationId: orgId,
        name: "Auto-assign referral leads",
        description: "Referral leads are hot — assign them to Amina immediately.",
        trigger: "LEAD_CREATED",
        conditions: [{ field: "source", operator: "EQUALS", value: "REFERRAL" }],
        actions: [{ type: "ASSIGN_OWNER", ownerId: owner.id }],
        isActive: true,
      },
      {
        organizationId: orgId,
        name: "Follow up on qualified leads",
        description: "Create a follow-up task whenever a lead becomes qualified.",
        trigger: "LEAD_STATUS_CHANGED",
        conditions: [{ field: "status", operator: "EQUALS", value: "QUALIFIED" }],
        actions: [{ type: "CREATE_FOLLOW_UP", subject: "Follow up with newly qualified lead", dueInDays: 2 }],
        isActive: true,
      },
      {
        organizationId: orgId,
        name: "Celebrate new deals",
        description: "Log a task to prep onboarding when a deal is created.",
        trigger: "DEAL_CREATED",
        conditions: [],
        actions: [{ type: "CREATE_TASK", subject: "Prepare onboarding checklist", dueInDays: 3 }],
        isActive: true,
      },
    ],
  });

  console.log("Seed complete:");
  console.log(`  Organization: ${organization.name} (${organization.slug})`);
  console.log(`  Login: ${owner.email} / ${DEMO_PASSWORD}`);
  console.log(`  Companies: ${companies.length}, Contacts: ${contacts.length}, Leads: ${leads.length}, Deals: ${deals.length}`);
  console.log(`  Documents: ${proposal.number}, ${quotation.number}, ${contract.number}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
