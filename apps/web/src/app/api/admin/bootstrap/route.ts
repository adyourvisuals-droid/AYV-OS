import { randomUUID, timingSafeEqual } from 'node:crypto';

import type { NextRequest } from 'next/server';

import { ALL_PERMISSIONS, SYSTEM_ROLES } from '@ayv/types';

import { hashPassword } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, successResponse } from '@/lib/server/http';
import { MIGRATION_CHECKSUM, MIGRATION_NAME, MIGRATION_SQL } from '@/lib/server/migration-sql';
import { splitSqlStatements } from '@/lib/server/sql-statements';

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
 * Safety properties:
 *  - Gated behind BOOTSTRAP_SECRET, compared in constant time.
 *  - Fully idempotent: safe to call multiple times. Migration and seed steps
 *    each check current state first and skip whatever's already done.
 *  - Writes a real `_prisma_migrations` bookkeeping row with the exact
 *    checksum Prisma's own CLI computes (verified empirically against a real
 *    `prisma migrate deploy` run — see the commit that added this file), so
 *    a future genuine `prisma migrate deploy` against the same database
 *    recognises this migration as already applied instead of failing on
 *    already-existing tables.
 *  - Seeds the organisation, all 12 system roles with their full permission
 *    grants, and the demo users — enough for every role to log in with
 *    correct permissions. It deliberately does NOT seed the larger CRM mock
 *    dataset (clients/leads/projects/invoices/...); that still requires
 *    running the full apps/api/prisma/seed.ts from an environment with
 *    direct database access.
 *
 * Intended to be called once, then the BOOTSTRAP_SECRET env var removed.
 */

const DEMO_PASSWORD = 'AyvOs@2026!';

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

function authorised(req: NextRequest): boolean {
  const secret = process.env.BOOTSTRAP_SECRET;
  if (!secret) return false;

  const provided = req.headers.get('x-bootstrap-secret') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);

  // timingSafeEqual throws on length mismatch rather than returning false.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Invalid or missing bootstrap secret');
  }

  const steps: string[] = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    steps.push('connectivity: ok');
  } catch (error) {
    return errorResponse(
      503,
      'SERVICE_UNAVAILABLE',
      `Could not connect to the database: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // ─── Migration ───────────────────────────────────────────────────────────

  const migrationApplied = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations'
     ) as exists`,
  );

  const hasBookkeepingTable = migrationApplied[0]?.exists === true;

  const hasMigrationRow = hasBookkeepingTable
    ? (
        await prisma.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT count(*)::int as count FROM "_prisma_migrations" WHERE migration_name = $1`,
          MIGRATION_NAME,
        )
      )[0]?.count > 0
    : false;

  if (hasMigrationRow) {
    steps.push('migration: already applied, skipped');
  } else {
    const statements = splitSqlStatements(MIGRATION_SQL);

    const bookkeepingDdl = `
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
    `;

    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(bookkeepingDdl);
        for (const statement of statements) {
          await tx.$executeRawUnsafe(statement);
        }
        await tx.$executeRawUnsafe(
          `INSERT INTO "_prisma_migrations"
             (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
           VALUES ($1, $2, $3, now(), now(), $4)`,
          randomUUID(),
          MIGRATION_CHECKSUM,
          MIGRATION_NAME,
          statements.length,
        );
      },
      { timeout: 120_000, maxWait: 10_000 },
    );

    steps.push(`migration: applied ${statements.length} statements`);
  }

  // ─── Seed: organisation ──────────────────────────────────────────────────

  const existingOrg = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Organization" WHERE slug = $1`,
    'ad-your-vision',
  );

  let organizationId: string;

  if (existingOrg[0]) {
    organizationId = existingOrg[0].id;
    steps.push('organisation: already exists, skipped');
  } else {
    organizationId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Organization"
         (id, name, slug, "legalName", website, email, city, state, "stateCode",
          country, currency, timezone, "fiscalYearStartMonth", "workingDays",
          "workDayStart", "workDayEnd", settings, "featureFlags", "createdAt", "updatedAt")
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, '{}', '{}', now(), now())`,
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
    );
    steps.push('organisation: created');
  }

  // ─── Seed: permissions ───────────────────────────────────────────────────

  // apps/web's thin Permission model omits `domain` (only used by the RBAC
  // editor UI, which lives in the NestJS API, not here) — the underlying
  // table still has the column with no default, so it's left unset here and
  // is nullable at the DB level.
  await prisma.$transaction(
    ALL_PERMISSIONS.map((key) =>
      prisma.$executeRawUnsafe(
        `INSERT INTO "Permission" (id, key, domain) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO NOTHING`,
        randomUUID(),
        key,
        key.split(':')[0],
      ),
    ),
  );

  const permissionRows = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permissionIdByKey = new Map(permissionRows.map((row) => [row.key, row.id]));
  steps.push(`permissions: ${permissionRows.length} present`);

  // ─── Seed: roles ─────────────────────────────────────────────────────────
  //
  // Raw SQL throughout, not the typed client: apps/web's Prisma schema is a
  // deliberately narrow subset (see prisma/schema.prisma) that omits columns
  // like Role.organizationId / isSystem — present and NOT NULL on the real
  // table, but not worth declaring in a client that otherwise never needs
  // them. Raw SQL isn't constrained by the declared model, so it can still
  // populate every column the real table requires.

  const existingRoles = await prisma.role.findMany({ select: { key: true, id: true } });
  const roleIdByKey = new Map(existingRoles.map((role) => [role.key, role.id]));

  let rolesCreated = 0;

  for (const definition of SYSTEM_ROLES) {
    if (roleIdByKey.has(definition.key)) continue;

    const grants =
      definition.permissions === '*'
        ? ALL_PERMISSIONS.map((permission) => ({ permission, scope: 'ALL' as const }))
        : definition.permissions;

    const deduped = new Map<string, 'ALL' | 'TEAM' | 'OWN'>();
    for (const grant of grants) deduped.set(grant.permission, grant.scope ?? 'ALL');

    const roleId = randomUUID();

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Role" (id, "organizationId", key, name, description, "isSystem", level, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, $6, now(), now())`,
      roleId,
      organizationId,
      definition.key,
      definition.name,
      definition.description,
      definition.level,
    );

    for (const [permissionKey, scope] of deduped) {
      const permissionId = permissionIdByKey.get(permissionKey);
      if (!permissionId) continue;

      await prisma.$executeRawUnsafe(
        `INSERT INTO "RolePermission" (id, "roleId", "permissionId", scope)
         VALUES ($1, $2, $3, $4::"PermissionScope")`,
        randomUUID(),
        roleId,
        permissionId,
        scope,
      );
    }

    roleIdByKey.set(definition.key, roleId);
    rolesCreated += 1;
  }

  steps.push(`roles: ${rolesCreated} created, ${roleIdByKey.size} total`);

  // ─── Seed: demo users ────────────────────────────────────────────────────

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  let usersCreated = 0;

  for (const person of PEOPLE) {
    const existing = await prisma.user.findFirst({ where: { email: person.email } });
    if (existing) continue;

    const roleId = roleIdByKey.get(person.role);
    if (!roleId) continue;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "User"
         (id, "organizationId", email, "passwordHash", name, "userType", status,
          "roleId", designation, department, "joinedAt", "passwordChangedAt",
          "lastActiveAt", theme, preferences, "mfaEnabled", "createdAt", "updatedAt")
       VALUES
         ($1, $2, $3, $4, $5, 'EMPLOYEE', 'ACTIVE', $6, $7, $8, now(), now(), now(),
          'system', '{}', false, now(), now())`,
      randomUUID(),
      organizationId,
      person.email,
      passwordHash,
      person.name,
      roleId,
      person.designation,
      person.department,
    );
    usersCreated += 1;
  }

  steps.push(`users: ${usersCreated} created`);

  return successResponse({ steps, organizationId });
}
