import { randomUUID, timingSafeEqual } from 'node:crypto';

import { Client } from 'pg';

import type { NextRequest } from 'next/server';

import { ALL_PERMISSIONS, SYSTEM_ROLES } from '@ayv/types';

import { hashPassword } from '@/lib/server/auth';
import { resolveDatabaseUrl } from '@/lib/server/env';
import { errorResponse, successResponse } from '@/lib/server/http';
import { scoreLead } from '@/lib/server/lead-scoring';
import { MIGRATION_CHECKSUM, MIGRATION_NAME, MIGRATION_SQL } from '@/lib/server/migration-sql';
import { buildMultiRowInsert } from '@/lib/server/pg-batch';

export const runtime = 'nodejs';

/**
 * One-time production database bootstrap.
 *
 * This exists because the environment this code was developed in cannot open
 * a raw TCP connection to the production Postgres host (only HTTPS egress is
 * permitted there), so `prisma migrate deploy` / the seed script can't be run
 * from that environment directly — and the person operating the Vercel
 * project doesn't have a terminal available either. This route lets the
 * database be provisioned with one authenticated HTTPS request instead.
 *
 * Uses `pg` directly rather than Prisma's `$executeRawUnsafe`: Prisma always
 * sends raw queries over the extended (prepared-statement) protocol, which
 * Postgres restricts to one statement per call — a 321-statement migration
 * would be 321 round trips. Over a real network (as opposed to the loopback
 * connection this was first tested against) that was slow enough to exceed
 * Vercel's function execution limit and fail partway through. `pg`'s simple
 * query protocol executes an entire unparameterized multi-statement string
 * in one round trip, and multi-row `INSERT ... VALUES (...), (...), ...` is
 * one round trip regardless of driver — both are used throughout to keep
 * this to roughly a dozen round trips total instead of roughly a thousand.
 *
 * Safety properties:
 *  - Gated behind BOOTSTRAP_SECRET, compared in constant time.
 *  - Fully idempotent: safe to call multiple times. Every step checks
 *    current state first and skips whatever's already done.
 *  - Writes a real `_prisma_migrations` bookkeeping row with the exact
 *    checksum Prisma's own CLI computes (verified empirically against a real
 *    `prisma migrate deploy` run), so a future genuine `migrate deploy`
 *    against the same database recognises this migration as already applied
 *    instead of failing on already-existing tables.
 *  - Seeds the organisation, all 12 system roles with their full permission
 *    grants, and the demo users — enough for every role to log in with
 *    correct permissions. Deliberately does not seed the larger CRM mock
 *    dataset; that still needs the full apps/api/prisma/seed.ts run from an
 *    environment with direct database access.
 *
 * Intended to be called once, then the BOOTSTRAP_SECRET env var removed.
 */

const DEMO_PASSWORD = 'AyvOs@2026!';

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

const PEOPLE: { name: string; email: string; role: string; designation: string; department: string }[] = [
  { name: 'Rahul Sharma', email: 'rahul@adyourvision.com', role: 'SUPER_ADMIN', designation: 'Founder & CEO', department: 'Leadership' },
  { name: 'Meera Iyer', email: 'meera@adyourvision.com', role: 'OPERATIONS_HEAD', designation: 'Head of Operations', department: 'Operations' },
  { name: 'Vikram Desai', email: 'vikram@adyourvision.com', role: 'SALES_HEAD', designation: 'Head of Sales', department: 'Sales' },
  { name: 'Priya Nair', email: 'priya@adyourvision.com', role: 'SALES_EXECUTIVE', designation: 'Senior Sales Executive', department: 'Sales' },
  { name: 'Arjun Kulkarni', email: 'arjun@adyourvision.com', role: 'SALES_EXECUTIVE', designation: 'Sales Executive', department: 'Sales' },
  { name: 'Ananya Kapoor', email: 'ananya@adyourvision.com', role: 'CREATIVE_HEAD', designation: 'Creative Director', department: 'Creative' },
  { name: 'Sameer Mehta', email: 'sameer@adyourvision.com', role: 'DESIGNER', designation: 'Senior Designer', department: 'Creative' },
  { name: 'Riya Shah', email: 'riya@adyourvision.com', role: 'VIDEO_EDITOR', designation: 'Video Editor', department: 'Creative' },
  { name: 'Karan Verma', email: 'karan@adyourvision.com', role: 'DEVELOPER', designation: 'Full Stack Developer', department: 'Technology' },
  { name: 'Sneha Rao', email: 'sneha@adyourvision.com', role: 'HR', designation: 'HR Manager', department: 'People' },
  { name: 'Deepak Joshi', email: 'deepak@adyourvision.com', role: 'FINANCE', designation: 'Finance Manager', department: 'Finance' },
  { name: 'Ishita Bose', email: 'ishita@adyourvision.com', role: 'INTERN', designation: 'Design Intern', department: 'Creative' },
];

/**
 * Demo CRM/delivery/finance dataset, ported from apps/api/prisma/seed.ts so
 * the pages built on top of the new Next.js API routes have something to
 * show rather than rendering correctly-but-empty. Mirrors that file's data
 * exactly; keep the two in sync if either changes.
 */
const CLIENT_SEEDS: {
  name: string;
  legalName?: string;
  industry: string;
  status: string;
  email: string;
  city: string;
  state: string;
  stateCode: string;
  services: string[];
  monthlyRetainer: number;
  healthScore: number;
  accountManagerEmail: string;
  contractStartDays: number;
  renewalDays: number;
}[] = [
  { name: 'Skyline Realty', legalName: 'Skyline Realty Developers LLP', industry: 'REAL_ESTATE', status: 'ACTIVE', email: 'rajesh@skylinerealty.in', city: 'Mumbai', state: 'Maharashtra', stateCode: '27', services: ['BRANDING', 'SOCIAL_MEDIA', 'META_ADS'], monthlyRetainer: 180_000, healthScore: 52, accountManagerEmail: 'priya@adyourvision.com', contractStartDays: -240, renewalDays: 125 },
  { name: 'Meridian Health', industry: 'HEALTHCARE', status: 'ACTIVE', email: 'contact@meridianhealth.in', city: 'Pune', state: 'Maharashtra', stateCode: '27', services: ['SOCIAL_MEDIA', 'PERFORMANCE_MARKETING', 'GOOGLE_ADS'], monthlyRetainer: 145_000, healthScore: 81, accountManagerEmail: 'arjun@adyourvision.com', contractStartDays: -400, renewalDays: 28 },
  { name: 'Nova Automotive', industry: 'AUTOMOBILE', status: 'ACTIVE', email: 'marketing@novaauto.in', city: 'Bengaluru', state: 'Karnataka', stateCode: '29', services: ['META_ADS', 'VIDEO_EDITING', 'AI_VIDEO'], monthlyRetainer: 220_000, healthScore: 88, accountManagerEmail: 'priya@adyourvision.com', contractStartDays: -150, renewalDays: 215 },
  { name: 'Bloom Education', industry: 'EDUCATION', status: 'ACTIVE', email: 'hello@bloomedu.in', city: 'Mumbai', state: 'Maharashtra', stateCode: '27', services: ['BRANDING', 'WEBSITE', 'GRAPHIC_DESIGN'], monthlyRetainer: 95_000, healthScore: 74, accountManagerEmail: 'arjun@adyourvision.com', contractStartDays: -90, renewalDays: 275 },
  { name: 'Vertex Retail', industry: 'RETAIL', status: 'ONBOARDING', email: 'ops@vertexretail.in', city: 'Delhi', state: 'Delhi', stateCode: '07', services: ['WEBSITE', 'PERFORMANCE_MARKETING'], monthlyRetainer: 130_000, healthScore: 68, accountManagerEmail: 'priya@adyourvision.com', contractStartDays: -20, renewalDays: 345 },
  { name: 'Aster Wellness', industry: 'HEALTHCARE', status: 'ACTIVE', email: 'team@asterwellness.in', city: 'Hyderabad', state: 'Telangana', stateCode: '36', services: ['SOCIAL_MEDIA', 'AI_CONTENT'], monthlyRetainer: 78_000, healthScore: 36, accountManagerEmail: 'arjun@adyourvision.com', contractStartDays: -320, renewalDays: 45 },
];

const LEAD_SEEDS: {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  industry: string;
  services: string[];
  value: number;
  ownerEmail: string;
  days: number;
}[] = [
  { name: 'Horizon Builders', contactName: 'Nikhil Menon', email: 'nikhil@horizonbuilders.in', phone: '+919812345601', source: 'META', status: 'NEW', industry: 'REAL_ESTATE', services: ['BRANDING', 'META_ADS'], value: 320_000, ownerEmail: 'priya@adyourvision.com', days: 2 },
  { name: 'Crest Diagnostics', contactName: 'Dr. Anita Rao', email: 'anita@crestdiag.in', phone: '+919812345602', source: 'GOOGLE', status: 'NEW', industry: 'HEALTHCARE', services: ['SOCIAL_MEDIA'], value: 85_000, ownerEmail: 'arjun@adyourvision.com', days: 1 },
  { name: 'Lumina Interiors', contactName: 'Farah Sheikh', email: 'farah@luminainteriors.in', phone: '+919812345603', source: 'REFERRAL', status: 'CONTACTED', industry: 'RETAIL', services: ['BRANDING', 'GRAPHIC_DESIGN', 'WEBSITE'], value: 410_000, ownerEmail: 'priya@adyourvision.com', days: 5 },
  { name: 'Pinnacle Academy', contactName: 'Suresh Pillai', email: 'suresh@pinnacleacademy.in', phone: '+919812345604', source: 'WEBSITE', status: 'CONTACTED', industry: 'EDUCATION', services: ['PERFORMANCE_MARKETING', 'GOOGLE_ADS'], value: 190_000, ownerEmail: 'arjun@adyourvision.com', days: 8 },
  { name: 'Zenith Motors', contactName: 'Kabir Malhotra', email: 'kabir@zenithmotors.in', phone: '+919812345605', source: 'REFERRAL', status: 'QUALIFIED', industry: 'AUTOMOBILE', services: ['META_ADS', 'AI_VIDEO', 'VIDEO_EDITING'], value: 560_000, ownerEmail: 'priya@adyourvision.com', days: 3 },
  { name: 'Orchid Hospitality', contactName: 'Neha Gupta', email: 'neha@orchidhotels.in', phone: '+919812345606', source: 'LINKEDIN', status: 'QUALIFIED', industry: 'HOSPITALITY', services: ['SOCIAL_MEDIA', 'AI_CONTENT'], value: 240_000, ownerEmail: 'arjun@adyourvision.com', days: 6 },
  { name: 'Fintrust Advisors', contactName: 'Rohan Bhat', email: 'rohan@fintrust.in', phone: '+919812345607', source: 'WEBSITE', status: 'PROPOSAL', industry: 'FINANCE', services: ['BRANDING', 'WEBSITE'], value: 375_000, ownerEmail: 'priya@adyourvision.com', days: 4 },
  { name: 'Kinetic Sports', contactName: 'Tara Singh', email: 'tara@kineticsports.in', phone: '+919812345608', source: 'META', status: 'PROPOSAL', industry: 'RETAIL', services: ['PERFORMANCE_MARKETING'], value: 155_000, ownerEmail: 'arjun@adyourvision.com', days: 11 },
  { name: 'Solaris Energy', contactName: 'Manish Agarwal', email: 'manish@solarisenergy.in', phone: '+919812345609', source: 'REFERRAL', status: 'NEGOTIATION', industry: 'TECHNOLOGY', services: ['BRANDING', 'WEBSITE', 'CONSULTING'], value: 680_000, ownerEmail: 'priya@adyourvision.com', days: 2 },
  { name: 'Verve Salon Group', contactName: 'Ayesha Khan', email: 'ayesha@vervesalon.in', phone: '+919812345610', source: 'WHATSAPP', status: 'NEGOTIATION', industry: 'RETAIL', services: ['SOCIAL_MEDIA', 'GRAPHIC_DESIGN'], value: 125_000, ownerEmail: 'arjun@adyourvision.com', days: 7 },
  { name: 'Terra Landscapes', contactName: 'Vivek Ranjan', email: 'vivek@terraland.in', phone: '+919812345611', source: 'MANUAL', status: 'CONTACTED', industry: 'OTHER', services: ['GRAPHIC_DESIGN'], value: 65_000, ownerEmail: 'vikram@adyourvision.com', days: 21 },
  { name: 'Apex Legal', contactName: 'Sonia Dutta', email: 'sonia@apexlegal.in', phone: '+919812345612', source: 'LINKEDIN', status: 'NEW', industry: 'OTHER', services: ['BRANDING', 'WEBSITE'], value: 210_000, ownerEmail: 'vikram@adyourvision.com', days: 1 },
];

const PROJECT_SEEDS: {
  name: string;
  clientName: string;
  managerEmail: string;
  status: string;
  budget: number;
  cost: number;
  due: number;
  services: string[];
}[] = [
  { name: 'Skyline Realty — Q3 Brand Campaign', clientName: 'Skyline Realty', managerEmail: 'ananya@adyourvision.com', status: 'ACTIVE', budget: 240_000, cost: 148_000, due: 15, services: ['BRANDING', 'SOCIAL_MEDIA'] },
  { name: 'Meridian Health — Always-on Social', clientName: 'Meridian Health', managerEmail: 'ananya@adyourvision.com', status: 'ACTIVE', budget: 180_000, cost: 96_000, due: 40, services: ['SOCIAL_MEDIA', 'PERFORMANCE_MARKETING'] },
  { name: 'Nova Automotive — Launch Film', clientName: 'Nova Automotive', managerEmail: 'meera@adyourvision.com', status: 'ACTIVE', budget: 320_000, cost: 210_000, due: 8, services: ['VIDEO_EDITING', 'AI_VIDEO'] },
  { name: 'Bloom Education — Website Revamp', clientName: 'Bloom Education', managerEmail: 'karan@adyourvision.com', status: 'ACTIVE', budget: 275_000, cost: 121_000, due: 61, services: ['WEBSITE'] },
  { name: 'Vertex Retail — Onboarding', clientName: 'Vertex Retail', managerEmail: 'meera@adyourvision.com', status: 'PLANNING', budget: 130_000, cost: 22_000, due: 30, services: ['WEBSITE', 'PERFORMANCE_MARKETING'] },
  { name: 'Aster Wellness — Content Engine', clientName: 'Aster Wellness', managerEmail: 'ananya@adyourvision.com', status: 'ON_HOLD', budget: 96_000, cost: 71_000, due: -6, services: ['AI_CONTENT', 'SOCIAL_MEDIA'] },
];

const TASK_TEMPLATES: {
  title: string;
  status: string;
  priority: string;
  assigneeEmail: string | null;
  offset: number;
  hours: number;
  clientVisible?: boolean;
}[] = [
  { title: 'Brand guidelines document', status: 'DONE', priority: 'HIGH', assigneeEmail: 'sameer@adyourvision.com', offset: -12, hours: 12 },
  { title: 'Logo variant exploration', status: 'DONE', priority: 'MEDIUM', assigneeEmail: 'sameer@adyourvision.com', offset: -8, hours: 8 },
  { title: 'Social media template kit', status: 'IN_PROGRESS', priority: 'HIGH', assigneeEmail: 'sameer@adyourvision.com', offset: 1, hours: 10 },
  { title: 'Launch teaser reel — 30s', status: 'IN_PROGRESS', priority: 'URGENT', assigneeEmail: 'riya@adyourvision.com', offset: -1, hours: 14 },
  { title: 'Campaign landing page', status: 'IN_REVIEW', priority: 'HIGH', assigneeEmail: 'karan@adyourvision.com', offset: 3, hours: 20 },
  { title: 'Brochure design v2', status: 'IN_REVIEW', priority: 'MEDIUM', assigneeEmail: 'sameer@adyourvision.com', offset: 2, hours: 6, clientVisible: true },
  { title: 'Performance report — month 1', status: 'TODO', priority: 'MEDIUM', assigneeEmail: 'karan@adyourvision.com', offset: 7, hours: 4 },
  { title: 'Competitor content audit', status: 'TODO', priority: 'LOW', assigneeEmail: 'riya@adyourvision.com', offset: 10, hours: 5 },
  { title: 'Influencer shortlist', status: 'BACKLOG', priority: 'LOW', assigneeEmail: null, offset: 18, hours: 3 },
  { title: 'Q4 campaign concepts', status: 'BACKLOG', priority: 'MEDIUM', assigneeEmail: null, offset: 25, hours: 8 },
];

const RETAINER_CLIENTS: { clientName: string; amount: number }[] = [
  { clientName: 'Skyline Realty', amount: 180_000 },
  { clientName: 'Meridian Health', amount: 145_000 },
  { clientName: 'Nova Automotive', amount: 220_000 },
  { clientName: 'Bloom Education', amount: 95_000 },
  { clientName: 'Aster Wellness', amount: 78_000 },
  { clientName: 'Vertex Retail', amount: 130_000 },
];

const MONTHLY_COSTS: { title: string; category: string; amount: number; day: number }[] = [
  { title: 'Team salaries', category: 'Payroll', amount: 385_000, day: -1 },
  { title: 'Office rent', category: 'Rent', amount: 85_000, day: -3 },
  { title: 'Software subscriptions', category: 'Software', amount: 46_000, day: -8 },
  { title: 'Freelance production', category: 'Contractors', amount: 52_000, day: -12 },
  { title: 'AI API usage', category: 'Software', amount: 28_000, day: -6 },
  { title: 'Marketing and travel', category: 'Operations', amount: 24_000, day: -16 },
];

function authorised(req: NextRequest): boolean {
  const secret = process.env.BOOTSTRAP_SECRET;
  if (!secret) return false;

  const provided = req.headers.get('x-bootstrap-secret') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Invalid or missing bootstrap secret');
  }

  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'No database URL configured. Set DATABASE_URL, PRISMA_DATABASE_URL or POSTGRES_URL.',
    );
  }

  if (databaseUrl.startsWith('prisma://') || databaseUrl.startsWith('prisma+postgres://')) {
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'The configured database URL is a Prisma Accelerate proxy URL, which the ' +
        'pg driver cannot use. This route needs a direct postgres:// connection string.',
    );
  }

  // Managed Postgres providers often present a cert chain Node's default
  // trust store doesn't recognise; `sslmode=require` in the connection
  // string only requires *some* TLS, so skipping certificate validation is
  // still an encrypted connection, just not certificate-validated. Only
  // applied when the connection string actually asks for SSL — local
  // Postgres in development has no SSL listener at all, and forcing a TLS
  // handshake against it would break local testing.
  const wantsSsl = /sslmode=require|sslmode=prefer/.test(databaseUrl);

  const client = new Client({
    connectionString: databaseUrl,
    ...(wantsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    // Bounded connect/query timeouts turn a silent network-level hang into
    // a real, catchable error instead of running past the platform's
    // function time limit with no diagnostic information at all.
    connectionTimeoutMillis: 10_000,
    query_timeout: 60_000,
  });
  const steps: string[] = [];

  try {
    // A hard backstop independent of `connectionTimeoutMillis`: if the
    // driver's own timeout option doesn't fire for some reason specific to
    // this runtime, this still turns a hang into a clear, catchable error
    // within a bounded time instead of running until the platform kills
    // the function with no diagnostic information at all.
    await Promise.race([
      client.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('connect() did not resolve within 12s')), 12_000),
      ),
    ]);
    await client.query('SELECT 1');
    steps.push('connectivity: ok');

    // ─── Migration ─────────────────────────────────────────────────────────

    const bookkeepingExists = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations'
       ) as exists`,
    );

    const hasMigrationRow = bookkeepingExists.rows[0]?.exists
      ? (
          await client.query<{ count: number }>(
            `SELECT count(*)::int as count FROM "_prisma_migrations" WHERE migration_name = $1`,
            [MIGRATION_NAME],
          )
        ).rows[0].count > 0
      : false;

    if (hasMigrationRow) {
      steps.push('migration: already applied, skipped');
    } else {
      // One round trip for the bookkeeping table plus the entire migration —
      // `pg`'s simple query protocol runs an unparameterized multi-statement
      // string as a single request. The values below are fixed constants
      // this file defines, not request input, so inlining them is safe.
      await client.query(`
        CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
          "id" VARCHAR(36) PRIMARY KEY,
          "checksum" VARCHAR(64) NOT NULL,
          "finished_at" TIMESTAMPTZ,
          "migration_name" VARCHAR(255) NOT NULL,
          "logs" TEXT,
          "rolled_back_at" TIMESTAMPTZ,
          "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "applied_steps_count" INTEGER NOT NULL DEFAULT 0
        );

        ${MIGRATION_SQL}
      `);

      await client.query(
        `INSERT INTO "_prisma_migrations"
           (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
         VALUES ($1, $2, $3, now(), now(), $4)`,
        [randomUUID(), MIGRATION_CHECKSUM, MIGRATION_NAME, 321],
      );

      steps.push('migration: applied');
    }

    // ─── Seed: organisation ──────────────────────────────────────────────────

    const existingOrg = await client.query<{ id: string }>(
      `SELECT id FROM "Organization" WHERE slug = $1`,
      ['ad-your-vision'],
    );

    let organizationId: string;

    if (existingOrg.rows[0]) {
      organizationId = existingOrg.rows[0].id;
      steps.push('organisation: already exists, skipped');
    } else {
      organizationId = randomUUID();
      await client.query(
        `INSERT INTO "Organization"
           (id, name, slug, "legalName", website, email, city, state, "stateCode",
            country, currency, timezone, "fiscalYearStartMonth", "workingDays",
            "workDayStart", "workDayEnd", settings, "featureFlags", "createdAt", "updatedAt")
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, '{}', '{}', now(), now())`,
        [
          organizationId,
          'Ad Your Vision',
          'ad-your-vision',
          'Ad Your Vision Media Pvt. Ltd.',
          'https://adyourvision.com',
          'hello@adyourvision.com',
          'Mumbai',
          'Maharashtra',
          '27',
          'India',
          'INR',
          'Asia/Kolkata',
          4,
          [1, 2, 3, 4, 5, 6],
          '10:00',
          '19:00',
        ],
      );
      steps.push('organisation: created');
    }

    // ─── Seed: permissions ───────────────────────────────────────────────────

    const permissionInsert = buildMultiRowInsert(
      'Permission',
      ['id', 'key', 'domain'],
      ALL_PERMISSIONS.map((key) => [randomUUID(), key, key.split(':')[0]]),
      'ON CONFLICT (key) DO NOTHING',
    );
    await client.query(permissionInsert.text, permissionInsert.values);

    const permissionRows = await client.query<{ id: string; key: string }>(
      `SELECT id, key FROM "Permission"`,
    );
    const permissionIdByKey = new Map(permissionRows.rows.map((row) => [row.key, row.id]));
    steps.push(`permissions: ${permissionRows.rows.length} present`);

    // ─── Seed: roles + grants ────────────────────────────────────────────────
    //
    // Self-healing, not just idempotent: an earlier, slower version of this
    // route (hundreds of unbatched round trips) could be killed by Vercel's
    // function execution limit partway through a production run, potentially
    // leaving a role row created with zero permission grants. Rather than
    // trusting "the role exists" to mean "the role is fully set up", roles
    // with no existing grants get their grants filled in regardless.

    const existingRoles = await client.query<{ key: string; id: string }>(`SELECT id, key FROM "Role"`);
    const roleIdByKey = new Map(existingRoles.rows.map((row) => [row.key, row.id]));

    const existingGrantCounts = await client.query<{ roleId: string; count: number }>(
      `SELECT "roleId", count(*)::int as count FROM "RolePermission" GROUP BY "roleId"`,
    );
    const grantCountByRoleId = new Map(existingGrantCounts.rows.map((row) => [row.roleId, row.count]));

    const roleRows: unknown[][] = [];
    const grantRows: unknown[][] = [];
    let rolesHealed = 0;

    for (const definition of SYSTEM_ROLES) {
      let roleId = roleIdByKey.get(definition.key);

      if (!roleId) {
        roleId = randomUUID();
        roleIdByKey.set(definition.key, roleId);
        roleRows.push([
          roleId,
          organizationId,
          definition.key,
          definition.name,
          definition.description,
          true,
          definition.level,
          new Date(),
        ]);
      } else if ((grantCountByRoleId.get(roleId) ?? 0) > 0) {
        // Role exists and already has grants — genuinely done, skip.
        continue;
      } else {
        rolesHealed += 1;
      }

      const grants =
        definition.permissions === '*'
          ? ALL_PERMISSIONS.map((permission) => ({ permission, scope: 'ALL' as const }))
          : definition.permissions;

      const deduped = new Map<string, 'ALL' | 'TEAM' | 'OWN'>();
      for (const grant of grants) deduped.set(grant.permission, grant.scope ?? 'ALL');

      for (const [permissionKey, scope] of deduped) {
        const permissionId = permissionIdByKey.get(permissionKey);
        if (permissionId) grantRows.push([randomUUID(), roleId, permissionId, scope]);
      }
    }

    if (roleRows.length > 0) {
      const roleInsert = buildMultiRowInsert(
        'Role',
        ['id', 'organizationId', 'key', 'name', 'description', 'isSystem', 'level', 'updatedAt'],
        roleRows,
      );
      await client.query(roleInsert.text, roleInsert.values);
    }

    if (grantRows.length > 0) {
      // A single INSERT with ~700 value rows is still one round trip.
      const grantInsert = buildMultiRowInsert(
        'RolePermission',
        ['id', 'roleId', 'permissionId', 'scope'],
        grantRows,
      );
      await client.query(grantInsert.text, grantInsert.values);
    }

    steps.push(
      `roles: ${roleRows.length} created, ${rolesHealed} healed (missing grants filled in), ` +
        `${grantRows.length} permission grants written, ${roleIdByKey.size} total`,
    );

    // ─── Seed: demo users ────────────────────────────────────────────────────

    const existingUsers = await client.query<{ email: string }>(
      `SELECT email FROM "User" WHERE email = ANY($1::text[])`,
      [PEOPLE.map((person) => person.email)],
    );
    const existingEmails = new Set(existingUsers.rows.map((row) => row.email));

    const newPeople = PEOPLE.filter((person) => !existingEmails.has(person.email) && roleIdByKey.has(person.role));

    if (newPeople.length > 0) {
      const passwordHash = await hashPassword(DEMO_PASSWORD);

      const now = new Date();

      const userInsert = buildMultiRowInsert(
        'User',
        [
          'id',
          'organizationId',
          'email',
          'passwordHash',
          'name',
          'userType',
          'status',
          'roleId',
          'designation',
          'department',
          'theme',
          'preferences',
          'mfaEnabled',
          'joinedAt',
          'passwordChangedAt',
          'lastActiveAt',
          'updatedAt',
        ],
        newPeople.map((person) => [
          randomUUID(),
          organizationId,
          person.email,
          passwordHash,
          person.name,
          'EMPLOYEE',
          'ACTIVE',
          roleIdByKey.get(person.role),
          person.designation,
          person.department,
          'system',
          '{}',
          false,
          now,
          now,
          now,
          now,
        ]),
      );

      await client.query(userInsert.text, userInsert.values);
    }

    steps.push(`users: ${newPeople.length} created`);

    // ─── Demo dataset: clients, leads, projects/tasks, invoices, expenses ────
    //
    // The pages built on the new Next.js API routes need something to
    // render. Each section is skipped outright once any row for this
    // organisation already exists — coarser than the roles/grants
    // self-healing above, but adequate here since each section is a single
    // batched insert (one round trip), not hundreds of small ones.

    const allSeededUsers = await client.query<{ id: string; email: string }>(
      `SELECT id, email FROM "User" WHERE email = ANY($1::text[])`,
      [PEOPLE.map((person) => person.email)],
    );
    const userIdByEmail = new Map(allSeededUsers.rows.map((row) => [row.email, row.id]));
    const uid = (email: string): string => {
      const id = userIdByEmail.get(email);
      if (!id) throw new Error(`Expected a seeded user for ${email}`);
      return id;
    };

    // ─── Clients ─────────────────────────────────────────────────────────

    const existingClients = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM "Client" WHERE "organizationId" = $1`,
      [organizationId],
    );
    const clientIdByName = new Map(existingClients.rows.map((row) => [row.name, row.id]));

    const newClientSeeds = CLIENT_SEEDS.filter((seed) => !clientIdByName.has(seed.name));

    if (newClientSeeds.length > 0) {
      const now = new Date();
      const rows = newClientSeeds.map((seed) => {
        const id = randomUUID();
        clientIdByName.set(seed.name, id);
        return [
          id,
          organizationId,
          seed.name,
          seed.legalName ?? null,
          seed.industry,
          seed.status,
          seed.email,
          seed.city,
          seed.state,
          seed.stateCode,
          'India',
          seed.services,
          seed.monthlyRetainer,
          seed.healthScore,
          uid(seed.accountManagerEmail),
          daysFromNow(seed.contractStartDays),
          daysFromNow(seed.renewalDays),
          now,
          now,
        ];
      });

      const insert = buildMultiRowInsert(
        'Client',
        [
          'id', 'organizationId', 'name', 'legalName', 'industry', 'status', 'email',
          'city', 'state', 'stateCode', 'country', 'services', 'monthlyRetainer',
          'healthScore', 'accountManagerId', 'contractStartDate', 'renewalDate',
          'createdAt', 'updatedAt',
        ],
        rows,
      );
      await client.query(insert.text, insert.values);
    }

    steps.push(`clients: ${newClientSeeds.length} created, ${clientIdByName.size} total`);

    // ─── Leads ───────────────────────────────────────────────────────────

    const existingLeads = await client.query<{ email: string }>(
      `SELECT email FROM "Lead" WHERE "organizationId" = $1`,
      [organizationId],
    );
    const existingLeadEmails = new Set(existingLeads.rows.map((row) => row.email));
    const newLeadSeeds = LEAD_SEEDS.filter((seed) => !existingLeadEmails.has(seed.email));

    if (newLeadSeeds.length > 0) {
      const now = new Date();
      const leadIds: string[] = [];

      const rows = newLeadSeeds.map((seed) => {
        const id = randomUUID();
        leadIds.push(id);
        const createdAt = daysFromNow(-seed.days - 3);
        const scored = scoreLead({
          source: seed.source,
          status: seed.status,
          estimatedValue: seed.value,
          industry: seed.industry,
          services: seed.services,
          email: seed.email,
          phone: seed.phone,
          contactName: seed.contactName,
          createdAt,
          lastActivityAt: daysFromNow(-Math.max(1, Math.floor(seed.days / 2))),
          activityCount: seed.status === 'NEW' ? 0 : 1,
        });

        return [
          id,
          organizationId,
          seed.name,
          seed.contactName,
          seed.email,
          seed.phone,
          seed.source,
          seed.status,
          scored.temperature,
          seed.industry,
          seed.services,
          seed.value,
          scored.score,
          scored.closeProbability,
          uid(seed.ownerEmail),
          `Inbound enquiry for ${seed.services.join(', ').toLowerCase()}.`,
          createdAt,
          daysFromNow(-seed.days),
          daysFromNow(-Math.max(1, Math.floor(seed.days / 2))),
          now,
        ];
      });

      const leadInsert = buildMultiRowInsert(
        'Lead',
        [
          'id', 'organizationId', 'name', 'contactName', 'email', 'phone', 'source',
          'status', 'temperature', 'industry', 'services', 'estimatedValue', 'score',
          'closeProbability', 'ownerId', 'notes', 'createdAt', 'stageChangedAt',
          'lastActivityAt', 'updatedAt',
        ],
        rows,
      );
      await client.query(leadInsert.text, leadInsert.values);

      const activityRows = newLeadSeeds.map((seed, index) => [
        randomUUID(),
        organizationId,
        'SYSTEM',
        'Lead captured',
        `Source: ${seed.source}`,
        leadIds[index],
        uid(seed.ownerEmail),
        daysFromNow(-seed.days - 3),
        false,
      ]);
      const activityInsert = buildMultiRowInsert(
        'Activity',
        ['id', 'organizationId', 'type', 'title', 'body', 'leadId', 'actorId', 'occurredAt', 'isAiGenerated'],
        activityRows,
      );
      await client.query(activityInsert.text, activityInsert.values);
    }

    steps.push(`leads: ${newLeadSeeds.length} created (scored)`);

    // ─── Projects and tasks ───────────────────────────────────────────────

    const existingProjects = await client.query<{ code: string }>(
      `SELECT code FROM "Project" WHERE "organizationId" = $1`,
      [organizationId],
    );
    const existingProjectCodes = new Set(existingProjects.rows.map((row) => row.code));

    const newProjectSeeds = PROJECT_SEEDS.map((seed, index) => ({
      ...seed,
      code: `PRJ-${String(index + 1).padStart(4, '0')}`,
    })).filter((seed) => !existingProjectCodes.has(seed.code));

    let taskCount = 0;

    if (newProjectSeeds.length > 0) {
      const now = new Date();

      const projectRows = newProjectSeeds.map((seed) => [
        randomUUID(),
        organizationId,
        seed.clientName ? clientIdByName.get(seed.clientName) : null,
        seed.name,
        seed.code,
        `Delivery workstream for ${seed.clientName}.`,
        seed.status,
        seed.due < 10 ? 'HIGH' : 'MEDIUM',
        seed.services,
        uid(seed.managerEmail),
        daysFromNow(-45),
        daysFromNow(seed.due),
        seed.budget,
        seed.cost,
        now,
        now,
      ]);

      const projectInsert = buildMultiRowInsert(
        'Project',
        [
          'id', 'organizationId', 'clientId', 'name', 'code', 'description', 'status',
          'priority', 'services', 'managerId', 'startDate', 'dueDate', 'budget',
          'internalCost', 'createdAt', 'updatedAt',
        ],
        projectRows,
      );
      await client.query(projectInsert.text, projectInsert.values);

      const memberRows: unknown[][] = [];
      const taskRows: unknown[][] = [];

      newProjectSeeds.forEach((seed, projectIndex) => {
        const projectId = projectRows[projectIndex][0] as string;

        for (const email of ['sameer@adyourvision.com', 'riya@adyourvision.com', 'karan@adyourvision.com']) {
          memberRows.push([randomUUID(), projectId, uid(email), 40, now]);
        }

        const originalIndex = PROJECT_SEEDS.findIndex((p) => p.name === seed.name);
        const templates = TASK_TEMPLATES.slice(0, 6 + (originalIndex % 5));

        templates.forEach((template, position) => {
          taskRows.push([
            randomUUID(),
            organizationId,
            projectId,
            template.title,
            `${template.title} for ${seed.clientName}.`,
            template.status,
            template.priority,
            template.assigneeEmail ? uid(template.assigneeEmail) : null,
            daysFromNow(template.offset),
            (position + 1) * 1000,
            template.clientVisible ?? false,
            template.status === 'DONE' ? daysFromNow(template.offset) : null,
            template.hours,
            now,
            now,
          ]);
          taskCount += 1;
        });

        // `progress` is written directly here rather than derived after the
        // fact — recalculateProgress() (used by the move-task route going
        // forward) reads from Task rows that don't exist yet at seed time.
      });

      const memberInsert = buildMultiRowInsert(
        'ProjectMember',
        ['id', 'projectId', 'userId', 'allocation', 'createdAt'],
        memberRows,
      );
      await client.query(memberInsert.text, memberInsert.values);

      const taskInsert = buildMultiRowInsert(
        'Task',
        [
          'id', 'organizationId', 'projectId', 'title', 'description', 'status',
          'priority', 'assigneeId', 'dueDate', 'position', 'clientVisible',
          'completedAt', 'estimatedHours', 'createdAt', 'updatedAt',
        ],
        taskRows,
      );
      await client.query(taskInsert.text, taskInsert.values);

      // Progress per project, computed from the same templates used above.
      for (const [projectIndex, seed] of newProjectSeeds.entries()) {
        const projectId = projectRows[projectIndex][0] as string;
        const originalIndex = PROJECT_SEEDS.findIndex((p) => p.name === seed.name);
        const templates = TASK_TEMPLATES.slice(0, 6 + (originalIndex % 5));
        const done = templates.filter((t) => t.status === 'DONE').length;
        const progress = Math.round((done / templates.length) * 100);
        await client.query(`UPDATE "Project" SET progress = $1 WHERE id = $2`, [progress, projectId]);
      }
    }

    steps.push(`projects: ${newProjectSeeds.length} created, ${taskCount} tasks`);

    // ─── Invoices and payments ─────────────────────────────────────────────

    const existingInvoices = await client.query<{ number: string }>(
      `SELECT number FROM "Invoice" WHERE "organizationId" = $1`,
      [organizationId],
    );
    const existingInvoiceNumbers = new Set(existingInvoices.rows.map((row) => row.number));

    type InvoiceSeed = {
      clientName: string;
      number: string;
      total: number;
      status: string;
      issued: number;
      due: number;
      paid: number | null;
    };
    const invoiceSeeds: InvoiceSeed[] = [];
    let invoiceSequence = 1;

    for (let monthsAgo = 2; monthsAgo >= 0; monthsAgo -= 1) {
      for (const [index, retainer] of RETAINER_CLIENTS.entries()) {
        if (retainer.clientName === 'Vertex Retail' && monthsAgo > 0) continue;

        const issuedDate = new Date();
        issuedDate.setDate(1);
        issuedDate.setMonth(issuedDate.getMonth() - monthsAgo);
        issuedDate.setDate(3);
        const issued = Math.round((issuedDate.getTime() - Date.now()) / 86_400_000);
        const due = issued + 30;

        let status: string;
        let paid: number | null;

        if (monthsAgo >= 2) {
          status = 'PAID';
          paid = due - 3;
        } else if (monthsAgo === 1) {
          if (retainer.clientName === 'Aster Wellness') {
            status = 'OVERDUE';
            paid = null;
          } else {
            status = 'PAID';
            paid = due + 2;
          }
        } else if (retainer.clientName === 'Skyline Realty') {
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
          clientName: retainer.clientName,
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

    const newInvoiceSeeds = invoiceSeeds.filter((seed) => !existingInvoiceNumbers.has(seed.number));

    if (newInvoiceSeeds.length > 0) {
      const now = new Date();
      const invoiceRows = newInvoiceSeeds.map((seed) => {
        const subtotal = Math.round(seed.total / 1.18);
        const tax = seed.total - subtotal;
        return [
          randomUUID(),
          organizationId,
          clientIdByName.get(seed.clientName),
          seed.number,
          seed.status,
          daysFromNow(seed.issued),
          daysFromNow(seed.due),
          subtotal,
          Math.round(tax / 2),
          Math.round(tax / 2),
          tax,
          seed.total,
          seed.paid !== null ? seed.total : 0,
          seed.paid !== null ? daysFromNow(seed.paid) : null,
          seed.status === 'DRAFT' ? null : daysFromNow(seed.issued),
          now,
          now,
        ];
      });

      const invoiceInsert = buildMultiRowInsert(
        'Invoice',
        [
          'id', 'organizationId', 'clientId', 'number', 'status', 'issueDate', 'dueDate',
          'subtotal', 'cgst', 'sgst', 'taxAmount', 'total', 'amountPaid', 'paidAt',
          'sentAt', 'createdAt', 'updatedAt',
        ],
        invoiceRows,
      );
      await client.query(invoiceInsert.text, invoiceInsert.values);

      const itemRows = newInvoiceSeeds.map((seed, index) => {
        const invoiceId = invoiceRows[index][0] as string;
        const subtotal = Math.round(seed.total / 1.18);
        return [randomUUID(), invoiceId, `Monthly retainer — ${seed.clientName}`, 1, subtotal, 18, subtotal];
      });
      const itemInsert = buildMultiRowInsert(
        'InvoiceItem',
        ['id', 'invoiceId', 'description', 'quantity', 'unitPrice', 'taxRate', 'amount'],
        itemRows,
      );
      await client.query(itemInsert.text, itemInsert.values);

      const paymentRows = newInvoiceSeeds
        .map((seed, index) => ({ seed, invoiceId: invoiceRows[index][0] as string }))
        .filter(({ seed }) => seed.paid !== null)
        .map(({ seed, invoiceId }) => [
          randomUUID(),
          invoiceId,
          seed.total,
          'BANK_TRANSFER',
          daysFromNow(seed.paid!),
          `NEFT-${seed.number.slice(-4)}`,
        ]);

      if (paymentRows.length > 0) {
        const paymentInsert = buildMultiRowInsert(
          'Payment',
          ['id', 'invoiceId', 'amount', 'method', 'paidAt', 'reference'],
          paymentRows,
        );
        await client.query(paymentInsert.text, paymentInsert.values);
      }
    }

    steps.push(`invoices: ${newInvoiceSeeds.length} created`);

    // ─── Expenses ──────────────────────────────────────────────────────────

    const expenseSeeds: { title: string; category: string; amount: number; incurredAt: Date }[] = [];

    for (let monthsAgo = 2; monthsAgo >= 0; monthsAgo -= 1) {
      for (const cost of MONTHLY_COSTS) {
        const incurredAt = new Date();
        incurredAt.setDate(1);
        incurredAt.setMonth(incurredAt.getMonth() - monthsAgo);
        incurredAt.setDate(Math.min(28, 28 + cost.day));

        expenseSeeds.push({
          title: `${cost.title} — ${incurredAt.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`,
          category: cost.category,
          amount: Math.round(cost.amount * (1 + (monthsAgo % 2 === 0 ? 0.04 : -0.03))),
          incurredAt,
        });
      }
    }

    const existingExpenses = await client.query<{ title: string }>(
      `SELECT title FROM "Expense" WHERE "organizationId" = $1`,
      [organizationId],
    );
    const existingExpenseTitles = new Set(existingExpenses.rows.map((row) => row.title));
    const newExpenseSeeds = expenseSeeds.filter((seed) => !existingExpenseTitles.has(seed.title));

    if (newExpenseSeeds.length > 0) {
      const now = new Date();
      const expenseRows = newExpenseSeeds.map((seed) => [
        randomUUID(),
        organizationId,
        seed.title,
        seed.category,
        seed.amount,
        'APPROVED',
        seed.incurredAt,
        uid('deepak@adyourvision.com'),
        new Date(seed.incurredAt.getTime() + 86_400_000),
        now,
        now,
      ]);

      const expenseInsert = buildMultiRowInsert(
        'Expense',
        [
          'id', 'organizationId', 'title', 'category', 'amount', 'status', 'incurredAt',
          'submittedById', 'approvedAt', 'createdAt', 'updatedAt',
        ],
        expenseRows,
      );
      await client.query(expenseInsert.text, expenseInsert.values);
    }

    steps.push(`expenses: ${newExpenseSeeds.length} created`);

    return successResponse({ steps, organizationId });
  } catch (error) {
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      `Bootstrap failed at step "${steps[steps.length - 1] ?? 'connect'}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}
