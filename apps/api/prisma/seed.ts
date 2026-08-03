/**
 * Seed data for AYV OS.
 *
 * Idempotent: safe to run repeatedly. Everything keys off the organisation
 * slug, so a re-run updates rather than duplicating.
 *
 *   pnpm db:seed
 */

import { PrismaClient, type Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

import { ALL_PERMISSIONS, SYSTEM_ROLES } from '@ayv/types';

import { scoreLead } from '../src/modules/crm/lead-scoring';

const prisma = new PrismaClient();

const ORG_SLUG = 'ad-your-vision';
const DEFAULT_PASSWORD = 'AyvOs@2026!';

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

async function main(): Promise<void> {
  console.warn('Seeding AYV OS…\n');

  // ─── Permissions ─────────────────────────────────────────────────────────

  await prisma.permission.createMany({
    data: ALL_PERMISSIONS.map((key) => ({ key, domain: key.split(':')[0] })),
    skipDuplicates: true,
  });

  const permissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permissionIdByKey = new Map(permissions.map((row) => [row.key, row.id]));
  console.warn(`  permissions        ${permissions.length}`);

  // ─── Organisation ────────────────────────────────────────────────────────

  const organization = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: {},
    create: {
      name: 'Ad Your Vision',
      slug: ORG_SLUG,
      legalName: 'Ad Your Vision Media Pvt. Ltd.',
      website: 'https://adyourvision.com',
      email: 'hello@adyourvision.com',
      city: 'Mumbai',
      state: 'Maharashtra',
      stateCode: '27',
      country: 'India',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      fiscalYearStartMonth: 4,
    },
  });
  console.warn(`  organisation       ${organization.name}`);

  // ─── Roles ───────────────────────────────────────────────────────────────

  const roleIdByKey = new Map<string, string>();

  for (const definition of SYSTEM_ROLES) {
    const grants =
      definition.permissions === '*'
        ? ALL_PERMISSIONS.map((permission) => ({ permission, scope: 'ALL' as const }))
        : definition.permissions;

    const deduped = new Map<string, 'ALL' | 'TEAM' | 'OWN'>();
    for (const grant of grants) deduped.set(grant.permission, grant.scope ?? 'ALL');

    const role = await prisma.role.upsert({
      where: { organizationId_key: { organizationId: organization.id, key: definition.key } },
      update: { name: definition.name, description: definition.description, level: definition.level },
      create: {
        organizationId: organization.id,
        key: definition.key,
        name: definition.name,
        description: definition.description,
        level: definition.level,
        isSystem: true,
      },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: [...deduped.entries()]
        .filter(([key]) => permissionIdByKey.has(key))
        .map(([key, scope]) => ({
          roleId: role.id,
          permissionId: permissionIdByKey.get(key)!,
          scope,
        })),
      skipDuplicates: true,
    });

    roleIdByKey.set(definition.key, role.id);
  }
  console.warn(`  roles              ${roleIdByKey.size}`);

  // ─── Teams ───────────────────────────────────────────────────────────────

  const teamNames = ['Sales', 'Creative', 'Delivery', 'Growth'];
  const teamIdByName = new Map<string, string>();

  for (const name of teamNames) {
    const team = await prisma.team.upsert({
      where: { organizationId_name: { organizationId: organization.id, name } },
      update: {},
      create: { organizationId: organization.id, name },
    });
    teamIdByName.set(name, team.id);
  }
  console.warn(`  teams              ${teamIdByName.size}`);

  // ─── Users ───────────────────────────────────────────────────────────────

  const passwordHash = await argon2.hash(DEFAULT_PASSWORD, { type: argon2.argon2id });

  const people: {
    name: string;
    email: string;
    role: string;
    team?: string;
    designation: string;
    department: string;
  }[] = [
    { name: 'Rahul Sharma', email: 'rahul@adyourvision.com', role: 'SUPER_ADMIN', designation: 'Founder & CEO', department: 'Leadership' },
    { name: 'Meera Iyer', email: 'meera@adyourvision.com', role: 'OPERATIONS_HEAD', team: 'Delivery', designation: 'Head of Operations', department: 'Operations' },
    { name: 'Vikram Desai', email: 'vikram@adyourvision.com', role: 'SALES_HEAD', team: 'Sales', designation: 'Head of Sales', department: 'Sales' },
    { name: 'Priya Nair', email: 'priya@adyourvision.com', role: 'SALES_EXECUTIVE', team: 'Sales', designation: 'Senior Sales Executive', department: 'Sales' },
    { name: 'Arjun Kulkarni', email: 'arjun@adyourvision.com', role: 'SALES_EXECUTIVE', team: 'Sales', designation: 'Sales Executive', department: 'Sales' },
    { name: 'Ananya Kapoor', email: 'ananya@adyourvision.com', role: 'CREATIVE_HEAD', team: 'Creative', designation: 'Creative Director', department: 'Creative' },
    { name: 'Sameer Mehta', email: 'sameer@adyourvision.com', role: 'DESIGNER', team: 'Creative', designation: 'Senior Designer', department: 'Creative' },
    { name: 'Riya Shah', email: 'riya@adyourvision.com', role: 'VIDEO_EDITOR', team: 'Creative', designation: 'Video Editor', department: 'Creative' },
    { name: 'Karan Verma', email: 'karan@adyourvision.com', role: 'DEVELOPER', team: 'Delivery', designation: 'Full Stack Developer', department: 'Technology' },
    { name: 'Sneha Rao', email: 'sneha@adyourvision.com', role: 'HR', designation: 'HR Manager', department: 'People' },
    { name: 'Deepak Joshi', email: 'deepak@adyourvision.com', role: 'FINANCE', designation: 'Finance Manager', department: 'Finance' },
    { name: 'Ishita Bose', email: 'ishita@adyourvision.com', role: 'INTERN', team: 'Creative', designation: 'Design Intern', department: 'Creative' },
  ];

  const userIdByEmail = new Map<string, string>();

  for (const person of people) {
    const user = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: organization.id, email: person.email } },
      update: { name: person.name, roleId: roleIdByKey.get(person.role)! },
      create: {
        organizationId: organization.id,
        email: person.email,
        name: person.name,
        passwordHash,
        roleId: roleIdByKey.get(person.role)!,
        teamId: person.team ? teamIdByName.get(person.team) : null,
        designation: person.designation,
        department: person.department,
        status: 'ACTIVE',
        userType: 'EMPLOYEE',
        joinedAt: daysFromNow(-Math.floor(Math.random() * 900) - 60),
        lastActiveAt: new Date(),
      },
    });
    userIdByEmail.set(person.email, user.id);
  }
  console.warn(`  users              ${userIdByEmail.size}`);

  const priya = userIdByEmail.get('priya@adyourvision.com')!;
  const arjun = userIdByEmail.get('arjun@adyourvision.com')!;
  const vikram = userIdByEmail.get('vikram@adyourvision.com')!;
  const ananya = userIdByEmail.get('ananya@adyourvision.com')!;
  const sameer = userIdByEmail.get('sameer@adyourvision.com')!;
  const riya = userIdByEmail.get('riya@adyourvision.com')!;
  const karan = userIdByEmail.get('karan@adyourvision.com')!;
  const meera = userIdByEmail.get('meera@adyourvision.com')!;

  // ─── Clients ─────────────────────────────────────────────────────────────

  const clientSeeds: Prisma.ClientCreateInput[] = [
    {
      organization: { connect: { id: organization.id } },
      name: 'Skyline Realty',
      legalName: 'Skyline Realty Developers LLP',
      industry: 'REAL_ESTATE',
      status: 'ACTIVE',
      email: 'rajesh@skylinerealty.in',
      phone: '+919876543210',
      city: 'Mumbai',
      state: 'Maharashtra',
      stateCode: '27',
      services: ['BRANDING', 'SOCIAL_MEDIA', 'META_ADS'],
      monthlyRetainer: 180_000,
      healthScore: 52,
      accountManager: { connect: { id: priya } },
      contractStartDate: daysFromNow(-240),
      renewalDate: daysFromNow(125),
    },
    {
      organization: { connect: { id: organization.id } },
      name: 'Meridian Health',
      industry: 'HEALTHCARE',
      status: 'ACTIVE',
      email: 'contact@meridianhealth.in',
      city: 'Pune',
      state: 'Maharashtra',
      stateCode: '27',
      services: ['SOCIAL_MEDIA', 'PERFORMANCE_MARKETING', 'GOOGLE_ADS'],
      monthlyRetainer: 145_000,
      healthScore: 81,
      accountManager: { connect: { id: arjun } },
      contractStartDate: daysFromNow(-400),
      renewalDate: daysFromNow(28),
    },
    {
      organization: { connect: { id: organization.id } },
      name: 'Nova Automotive',
      industry: 'AUTOMOBILE',
      status: 'ACTIVE',
      email: 'marketing@novaauto.in',
      city: 'Bengaluru',
      state: 'Karnataka',
      stateCode: '29',
      services: ['META_ADS', 'VIDEO_EDITING', 'AI_VIDEO'],
      monthlyRetainer: 220_000,
      healthScore: 88,
      accountManager: { connect: { id: priya } },
      contractStartDate: daysFromNow(-150),
      renewalDate: daysFromNow(215),
    },
    {
      organization: { connect: { id: organization.id } },
      name: 'Bloom Education',
      industry: 'EDUCATION',
      status: 'ACTIVE',
      email: 'hello@bloomedu.in',
      city: 'Mumbai',
      state: 'Maharashtra',
      stateCode: '27',
      services: ['BRANDING', 'WEBSITE', 'GRAPHIC_DESIGN'],
      monthlyRetainer: 95_000,
      healthScore: 74,
      accountManager: { connect: { id: arjun } },
      contractStartDate: daysFromNow(-90),
      renewalDate: daysFromNow(275),
    },
    {
      organization: { connect: { id: organization.id } },
      name: 'Vertex Retail',
      industry: 'RETAIL',
      status: 'ONBOARDING',
      email: 'ops@vertexretail.in',
      city: 'Delhi',
      state: 'Delhi',
      stateCode: '07',
      services: ['WEBSITE', 'PERFORMANCE_MARKETING'],
      monthlyRetainer: 130_000,
      healthScore: 68,
      accountManager: { connect: { id: priya } },
      contractStartDate: daysFromNow(-20),
      renewalDate: daysFromNow(345),
    },
    {
      organization: { connect: { id: organization.id } },
      name: 'Aster Wellness',
      industry: 'HEALTHCARE',
      status: 'ACTIVE',
      email: 'team@asterwellness.in',
      city: 'Hyderabad',
      state: 'Telangana',
      stateCode: '36',
      services: ['SOCIAL_MEDIA', 'AI_CONTENT'],
      monthlyRetainer: 78_000,
      healthScore: 36,
      accountManager: { connect: { id: arjun } },
      contractStartDate: daysFromNow(-320),
      renewalDate: daysFromNow(45),
    },
  ];

  const clientIdByName = new Map<string, string>();

  for (const seed of clientSeeds) {
    const existing = await prisma.client.findFirst({
      where: { organizationId: organization.id, name: seed.name },
      select: { id: true },
    });

    const client = existing
      ? await prisma.client.update({ where: { id: existing.id }, data: { healthScore: seed.healthScore } })
      : await prisma.client.create({ data: seed });

    clientIdByName.set(client.name, client.id);
  }
  console.warn(`  clients            ${clientIdByName.size}`);

  // ─── Leads ───────────────────────────────────────────────────────────────

  const leadSeeds = [
    { name: 'Horizon Builders', contactName: 'Nikhil Menon', email: 'nikhil@horizonbuilders.in', phone: '+919812345601', source: 'META', status: 'NEW', industry: 'REAL_ESTATE', services: ['BRANDING', 'META_ADS'], value: 320_000, owner: priya, days: 2 },
    { name: 'Crest Diagnostics', contactName: 'Dr. Anita Rao', email: 'anita@crestdiag.in', phone: '+919812345602', source: 'GOOGLE', status: 'NEW', industry: 'HEALTHCARE', services: ['SOCIAL_MEDIA'], value: 85_000, owner: arjun, days: 1 },
    { name: 'Lumina Interiors', contactName: 'Farah Sheikh', email: 'farah@luminainteriors.in', phone: '+919812345603', source: 'REFERRAL', status: 'CONTACTED', industry: 'RETAIL', services: ['BRANDING', 'GRAPHIC_DESIGN', 'WEBSITE'], value: 410_000, owner: priya, days: 5 },
    { name: 'Pinnacle Academy', contactName: 'Suresh Pillai', email: 'suresh@pinnacleacademy.in', phone: '+919812345604', source: 'WEBSITE', status: 'CONTACTED', industry: 'EDUCATION', services: ['PERFORMANCE_MARKETING', 'GOOGLE_ADS'], value: 190_000, owner: arjun, days: 8 },
    { name: 'Zenith Motors', contactName: 'Kabir Malhotra', email: 'kabir@zenithmotors.in', phone: '+919812345605', source: 'REFERRAL', status: 'QUALIFIED', industry: 'AUTOMOBILE', services: ['META_ADS', 'AI_VIDEO', 'VIDEO_EDITING'], value: 560_000, owner: priya, days: 3 },
    { name: 'Orchid Hospitality', contactName: 'Neha Gupta', email: 'neha@orchidhotels.in', phone: '+919812345606', source: 'LINKEDIN', status: 'QUALIFIED', industry: 'HOSPITALITY', services: ['SOCIAL_MEDIA', 'AI_CONTENT'], value: 240_000, owner: arjun, days: 6 },
    { name: 'Fintrust Advisors', contactName: 'Rohan Bhat', email: 'rohan@fintrust.in', phone: '+919812345607', source: 'WEBSITE', status: 'PROPOSAL', industry: 'FINANCE', services: ['BRANDING', 'WEBSITE'], value: 375_000, owner: priya, days: 4 },
    { name: 'Kinetic Sports', contactName: 'Tara Singh', email: 'tara@kineticsports.in', phone: '+919812345608', source: 'META', status: 'PROPOSAL', industry: 'RETAIL', services: ['PERFORMANCE_MARKETING'], value: 155_000, owner: arjun, days: 11 },
    { name: 'Solaris Energy', contactName: 'Manish Agarwal', email: 'manish@solarisenergy.in', phone: '+919812345609', source: 'REFERRAL', status: 'NEGOTIATION', industry: 'TECHNOLOGY', services: ['BRANDING', 'WEBSITE', 'CONSULTING'], value: 680_000, owner: priya, days: 2 },
    { name: 'Verve Salon Group', contactName: 'Ayesha Khan', email: 'ayesha@vervesalon.in', phone: '+919812345610', source: 'WHATSAPP', status: 'NEGOTIATION', industry: 'RETAIL', services: ['SOCIAL_MEDIA', 'GRAPHIC_DESIGN'], value: 125_000, owner: arjun, days: 7 },
    { name: 'Terra Landscapes', contactName: 'Vivek Ranjan', email: 'vivek@terraland.in', phone: '+919812345611', source: 'MANUAL', status: 'CONTACTED', industry: 'OTHER', services: ['GRAPHIC_DESIGN'], value: 65_000, owner: vikram, days: 21 },
    { name: 'Apex Legal', contactName: 'Sonia Dutta', email: 'sonia@apexlegal.in', phone: '+919812345612', source: 'LINKEDIN', status: 'NEW', industry: 'OTHER', services: ['BRANDING', 'WEBSITE'], value: 210_000, owner: vikram, days: 1 },
  ];

  let leadCount = 0;

  for (const seed of leadSeeds) {
    const existing = await prisma.lead.findFirst({
      where: { organizationId: organization.id, email: seed.email },
      select: { id: true },
    });
    if (existing) {
      leadCount += 1;
      continue;
    }

    const createdAt = daysFromNow(-seed.days - 3);

    const lead = await prisma.lead.create({
      data: {
        organizationId: organization.id,
        name: seed.name,
        contactName: seed.contactName,
        email: seed.email,
        phone: seed.phone,
        source: seed.source as never,
        status: seed.status as never,
        industry: seed.industry as never,
        services: seed.services as never,
        estimatedValue: seed.value,
        ownerId: seed.owner,
        createdAt,
        stageChangedAt: daysFromNow(-seed.days),
        lastActivityAt: daysFromNow(-Math.max(1, Math.floor(seed.days / 2))),
        notes: `Inbound enquiry for ${seed.services.join(', ').toLowerCase()}.`,
      },
    });

    await prisma.activity.create({
      data: {
        organizationId: organization.id,
        leadId: lead.id,
        actorId: seed.owner,
        type: 'SYSTEM',
        title: 'Lead captured',
        body: `Source: ${seed.source}`,
        occurredAt: createdAt,
      },
    });

    if (seed.status !== 'NEW') {
      await prisma.activity.create({
        data: {
          organizationId: organization.id,
          leadId: lead.id,
          actorId: seed.owner,
          type: 'CALL',
          title: 'Discovery call',
          body: 'Discussed requirements, timeline and budget.',
          outcome: 'Positive — asked for a proposal',
          durationMinutes: 25,
          occurredAt: daysFromNow(-seed.days),
        },
      });
    }

    leadCount += 1;
  }

  // Run every seeded lead through the real scoring engine, so the board shows
  // genuine scores and temperatures rather than hand-picked numbers.
  const seededLeads = await prisma.lead.findMany({
    where: { organizationId: organization.id },
    include: { _count: { select: { activities: true } } },
  });

  for (const lead of seededLeads) {
    const result = scoreLead({
      source: lead.source,
      status: lead.status,
      estimatedValue: Number(lead.estimatedValue),
      industry: lead.industry,
      services: lead.services,
      email: lead.email,
      phone: lead.phone,
      contactName: lead.contactName,
      createdAt: lead.createdAt,
      lastActivityAt: lead.lastActivityAt,
      activityCount: lead._count.activities,
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        score: result.score,
        temperature: result.temperature,
        closeProbability: result.closeProbability,
      },
    });
  }

  console.warn(`  leads              ${leadCount} (scored)`);

  // ─── Projects and tasks ──────────────────────────────────────────────────

  const projectSeeds = [
    { name: 'Skyline Realty — Q3 Brand Campaign', client: 'Skyline Realty', manager: ananya, status: 'ACTIVE', budget: 240_000, cost: 148_000, due: 15, services: ['BRANDING', 'SOCIAL_MEDIA'] },
    { name: 'Meridian Health — Always-on Social', client: 'Meridian Health', manager: ananya, status: 'ACTIVE', budget: 180_000, cost: 96_000, due: 40, services: ['SOCIAL_MEDIA', 'PERFORMANCE_MARKETING'] },
    { name: 'Nova Automotive — Launch Film', client: 'Nova Automotive', manager: meera, status: 'ACTIVE', budget: 320_000, cost: 210_000, due: 8, services: ['VIDEO_EDITING', 'AI_VIDEO'] },
    { name: 'Bloom Education — Website Revamp', client: 'Bloom Education', manager: karan, status: 'ACTIVE', budget: 275_000, cost: 121_000, due: 61, services: ['WEBSITE'] },
    { name: 'Vertex Retail — Onboarding', client: 'Vertex Retail', manager: meera, status: 'PLANNING', budget: 130_000, cost: 22_000, due: 30, services: ['WEBSITE', 'PERFORMANCE_MARKETING'] },
    { name: 'Aster Wellness — Content Engine', client: 'Aster Wellness', manager: ananya, status: 'ON_HOLD', budget: 96_000, cost: 71_000, due: -6, services: ['AI_CONTENT', 'SOCIAL_MEDIA'] },
  ];

  const taskTemplates = [
    { title: 'Brand guidelines document', status: 'DONE', priority: 'HIGH', assignee: sameer, offset: -12, hours: 12 },
    { title: 'Logo variant exploration', status: 'DONE', priority: 'MEDIUM', assignee: sameer, offset: -8, hours: 8 },
    { title: 'Social media template kit', status: 'IN_PROGRESS', priority: 'HIGH', assignee: sameer, offset: 1, hours: 10 },
    { title: 'Launch teaser reel — 30s', status: 'IN_PROGRESS', priority: 'URGENT', assignee: riya, offset: -1, hours: 14 },
    { title: 'Campaign landing page', status: 'IN_REVIEW', priority: 'HIGH', assignee: karan, offset: 3, hours: 20 },
    { title: 'Brochure design v2', status: 'IN_REVIEW', priority: 'MEDIUM', assignee: sameer, offset: 2, hours: 6, clientVisible: true },
    { title: 'Performance report — month 1', status: 'TODO', priority: 'MEDIUM', assignee: karan, offset: 7, hours: 4 },
    { title: 'Competitor content audit', status: 'TODO', priority: 'LOW', assignee: riya, offset: 10, hours: 5 },
    { title: 'Influencer shortlist', status: 'BACKLOG', priority: 'LOW', assignee: null, offset: 18, hours: 3 },
    { title: 'Q4 campaign concepts', status: 'BACKLOG', priority: 'MEDIUM', assignee: null, offset: 25, hours: 8 },
  ];

  let projectCount = 0;
  let taskCount = 0;

  for (const [index, seed] of projectSeeds.entries()) {
    const code = `PRJ-${String(index + 1).padStart(4, '0')}`;

    const existing = await prisma.project.findFirst({
      where: { organizationId: organization.id, code },
      select: { id: true },
    });
    if (existing) {
      projectCount += 1;
      continue;
    }

    const project = await prisma.project.create({
      data: {
        organizationId: organization.id,
        clientId: clientIdByName.get(seed.client)!,
        name: seed.name,
        code,
        description: `Delivery workstream for ${seed.client}.`,
        status: seed.status as never,
        priority: seed.due < 10 ? 'HIGH' : 'MEDIUM',
        services: seed.services as never,
        managerId: seed.manager,
        startDate: daysFromNow(-45),
        dueDate: daysFromNow(seed.due),
        budget: seed.budget,
        internalCost: seed.cost,
        members: {
          create: [
            { userId: sameer, allocation: 40 },
            { userId: riya, allocation: 30 },
            { userId: karan, allocation: 30 },
          ],
        },
      },
    });

    // Vary the task set per project so boards do not all look identical.
    const templates = taskTemplates.slice(0, 6 + (index % 5));

    for (const [position, template] of templates.entries()) {
      await prisma.task.create({
        data: {
          organizationId: organization.id,
          projectId: project.id,
          title: template.title,
          description: `${template.title} for ${seed.client}.`,
          status: template.status as never,
          priority: template.priority as never,
          assigneeId: template.assignee,
          dueDate: daysFromNow(template.offset),
          estimatedHours: template.hours,
          position: (position + 1) * 1000,
          clientVisible: template.clientVisible ?? false,
          completedAt: template.status === 'DONE' ? daysFromNow(template.offset) : null,
        },
      });
      taskCount += 1;
    }

    const total = templates.length;
    const done = templates.filter((template) => template.status === 'DONE').length;
    await prisma.project.update({
      where: { id: project.id },
      data: { progress: Math.round((done / total) * 100) },
    });

    projectCount += 1;
  }
  console.warn(`  projects           ${projectCount}`);
  console.warn(`  tasks              ${taskCount}`);

  // ─── Invoices, payments, expenses ────────────────────────────────────────

  /**
   * Three months of retainer billing, generated rather than hand-listed, so
   * the dashboard's revenue trend and ageing buckets have real shape. The
   * current month is deliberately left partly uncollected — that is what
   * makes the receivables and cash-flow widgets show something worth looking
   * at.
   */
  const retainerClients: { client: string; amount: number }[] = [
    { client: 'Skyline Realty', amount: 180_000 },
    { client: 'Meridian Health', amount: 145_000 },
    { client: 'Nova Automotive', amount: 220_000 },
    { client: 'Bloom Education', amount: 95_000 },
    { client: 'Aster Wellness', amount: 78_000 },
    { client: 'Vertex Retail', amount: 130_000 },
  ];

  const invoiceSeeds: {
    client: string;
    number: string;
    total: number;
    status: string;
    issued: number;
    due: number;
    paid: number | null;
  }[] = [];

  let invoiceSequence = 1;

  for (let monthsAgo = 2; monthsAgo >= 0; monthsAgo -= 1) {
    for (const [index, retainer] of retainerClients.entries()) {
      // Vertex is still onboarding — it only starts billing this month.
      if (retainer.client === 'Vertex Retail' && monthsAgo > 0) continue;

      // Calendar-month arithmetic, not a 30-day offset — a `-2 days` offset
      // lands in the *previous* month whenever seeding happens on the 1st or
      // 2nd, which would put "this month's" invoices outside the current
      // month's revenue window.
      const issuedDate = new Date();
      issuedDate.setDate(1);
      issuedDate.setMonth(issuedDate.getMonth() - monthsAgo);
      issuedDate.setDate(3);
      const issued = Math.round((issuedDate.getTime() - Date.now()) / 86_400_000);
      const due = issued + 30;

      // Older months are settled. The current month is a mix of paid, sent
      // and overdue, and Aster (the unhealthy account) is a persistent
      // late payer.
      let status: string;
      let paid: number | null;

      if (monthsAgo >= 2) {
        status = 'PAID';
        paid = due - 3;
      } else if (monthsAgo === 1) {
        if (retainer.client === 'Aster Wellness') {
          status = 'OVERDUE';
          paid = null;
        } else {
          status = 'PAID';
          paid = due + 2;
        }
      } else if (retainer.client === 'Skyline Realty') {
        status = 'OVERDUE';
        paid = null;
      } else if (index % 3 === 0) {
        status = 'PAID';
        paid = issued + 8;
      } else if (index % 3 === 1) {
        status = 'SENT';
        paid = null;
      } else {
        status = 'VIEWED';
        paid = null;
      }

      invoiceSeeds.push({
        client: retainer.client,
        number: `INV-2026-${String(invoiceSequence).padStart(4, '0')}`,
        total: retainer.amount,
        status,
        issued,
        due,
        paid,
      });

      invoiceSequence += 1;
    }
  }

  let invoiceCount = 0;

  for (const seed of invoiceSeeds) {
    const existing = await prisma.invoice.findFirst({
      where: { organizationId: organization.id, number: seed.number },
      select: { id: true },
    });
    if (existing) {
      invoiceCount += 1;
      continue;
    }

    const subtotal = Math.round(seed.total / 1.18);
    const tax = seed.total - subtotal;

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: organization.id,
        clientId: clientIdByName.get(seed.client)!,
        number: seed.number,
        status: seed.status as never,
        issueDate: daysFromNow(seed.issued),
        dueDate: daysFromNow(seed.due),
        subtotal,
        // Intra-state supply → CGST + SGST split.
        cgst: Math.round(tax / 2),
        sgst: Math.round(tax / 2),
        taxAmount: tax,
        total: seed.total,
        amountPaid: seed.paid !== null ? seed.total : 0,
        paidAt: seed.paid !== null ? daysFromNow(seed.paid) : null,
        sentAt: seed.status === 'DRAFT' ? null : daysFromNow(seed.issued),
        items: {
          create: [
            {
              description: `Monthly retainer — ${seed.client}`,
              quantity: 1,
              unitPrice: subtotal,
              taxRate: 18,
              amount: subtotal,
            },
          ],
        },
      },
    });

    if (seed.paid !== null) {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: seed.total,
          method: 'BANK_TRANSFER',
          paidAt: daysFromNow(seed.paid),
          reference: `NEFT-${seed.number.slice(-4)}`,
        },
      });
    }

    invoiceCount += 1;
  }
  console.warn(`  invoices           ${invoiceCount}`);

  /**
   * Three months of operating costs, sized to leave a healthy but not
   * implausible margin against the retainer revenue above.
   */
  const monthlyCosts = [
    { title: 'Team salaries', category: 'Payroll', amount: 385_000, day: -1 },
    { title: 'Office rent', category: 'Rent', amount: 85_000, day: -3 },
    { title: 'Software subscriptions', category: 'Software', amount: 46_000, day: -8 },
    { title: 'Freelance production', category: 'Contractors', amount: 52_000, day: -12 },
    { title: 'AI API usage', category: 'Software', amount: 28_000, day: -6 },
    { title: 'Marketing and travel', category: 'Operations', amount: 24_000, day: -16 },
  ];

  const expenseSeeds: {
    title: string;
    category: string;
    amount: number;
    incurredAt: Date;
  }[] = [];

  for (let monthsAgo = 2; monthsAgo >= 0; monthsAgo -= 1) {
    for (const cost of monthlyCosts) {
      // Real calendar-month arithmetic, not 30-day approximation — otherwise
      // two batches can land in the same month and collide on title.
      const incurredAt = new Date();
      incurredAt.setDate(1);
      incurredAt.setMonth(incurredAt.getMonth() - monthsAgo);
      incurredAt.setDate(Math.min(28, 28 + cost.day));

      expenseSeeds.push({
        title: `${cost.title} — ${incurredAt.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`,
        category: cost.category,
        // Vary slightly month to month so trends are not perfectly flat.
        amount: Math.round(cost.amount * (1 + (monthsAgo % 2 === 0 ? 0.04 : -0.03))),
        incurredAt,
      });
    }
  }

  let expenseCount = 0;

  for (const seed of expenseSeeds) {
    const existing = await prisma.expense.findFirst({
      where: { organizationId: organization.id, title: seed.title },
      select: { id: true },
    });
    if (existing) {
      expenseCount += 1;
      continue;
    }

    await prisma.expense.create({
      data: {
        organizationId: organization.id,
        title: seed.title,
        category: seed.category,
        amount: seed.amount,
        status: 'APPROVED',
        incurredAt: seed.incurredAt,
        submittedById: userIdByEmail.get('deepak@adyourvision.com')!,
        approvedAt: new Date(seed.incurredAt.getTime() + 86_400_000),
      },
    });
    expenseCount += 1;
  }
  console.warn(`  expenses           ${expenseCount}`);

  // ─── AI agents ───────────────────────────────────────────────────────────

  const agents = [
    { key: 'SALES', name: 'Aria', autonomy: 'ACT_WITH_APPROVAL', description: 'Scores leads, drafts outreach and proposals, forecasts deals.' },
    { key: 'MARKETING', name: 'Nova', autonomy: 'SUGGEST', description: 'Monitors campaigns, diagnoses ROAS decline, generates ad copy.' },
    { key: 'DESIGN', name: 'Kite', autonomy: 'SUGGEST', description: 'Turns briefs into directions and checks brand compliance.' },
    { key: 'COPY', name: 'Quill', autonomy: 'ACT_WITH_APPROVAL', description: 'Writes captions, scripts and campaigns in each client’s voice.' },
    { key: 'PROJECT', name: 'Atlas', autonomy: 'ACT', description: 'Plans projects, assigns by capacity, detects schedule risk.' },
    { key: 'HR', name: 'Sage', autonomy: 'ACT_WITH_APPROVAL', description: 'Screens candidates and answers policy questions.' },
    { key: 'FINANCE', name: 'Ledger', autonomy: 'ACT_WITH_APPROVAL', description: 'Generates invoices, reconciles payments, forecasts cash flow.' },
    { key: 'LEGAL', name: 'Codex', autonomy: 'SUGGEST', description: 'Drafts contracts and flags unusual clauses.' },
    { key: 'MEETING', name: 'Echo', autonomy: 'ACT', description: 'Transcribes meetings and turns decisions into tasks.' },
    { key: 'SUPPORT', name: 'Halo', autonomy: 'ACT_WITH_APPROVAL', description: 'First response on client tickets, escalates what matters.' },
    { key: 'CEO', name: 'Vista', autonomy: 'SUGGEST', description: 'Read-only company-wide analyst and daily executive brief.' },
  ];

  for (const agent of agents) {
    await prisma.aiAgent.upsert({
      where: { organizationId_key: { organizationId: organization.id, key: agent.key } },
      update: { name: agent.name, description: agent.description },
      create: {
        organizationId: organization.id,
        key: agent.key,
        name: agent.name,
        description: agent.description,
        autonomy: agent.autonomy as never,
        systemPrompt: `You are ${agent.name}, the ${agent.key.toLowerCase()} agent for Ad Your Vision. ${agent.description}`,
        tools: [],
        isActive: true,
      },
    });
  }
  console.warn(`  ai agents          ${agents.length}`);

  console.warn('\nSeed complete.\n');
  console.warn('  Sign in with any of:');
  console.warn('    rahul@adyourvision.com   Super Admin');
  console.warn('    vikram@adyourvision.com  Sales Head');
  console.warn('    priya@adyourvision.com   Sales Executive');
  console.warn('    ananya@adyourvision.com  Creative Head');
  console.warn('    sameer@adyourvision.com  Designer');
  console.warn(`  Password: ${DEFAULT_PASSWORD}\n`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
