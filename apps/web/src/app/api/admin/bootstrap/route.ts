import { randomUUID, timingSafeEqual } from 'node:crypto';

import { Client } from 'pg';

import type { NextRequest } from 'next/server';

import { ALL_PERMISSIONS, SYSTEM_ROLES } from '@ayv/types';

import { hashPassword } from '@/lib/server/auth';
import { errorResponse, successResponse } from '@/lib/server/http';
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

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Invalid or missing bootstrap secret');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return errorResponse(500, 'INTERNAL_ERROR', 'DATABASE_URL is not configured');
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
