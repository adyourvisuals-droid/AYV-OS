/**
 * Applies pending migrations as part of the deployment build.
 *
 * Until now migrations were applied out of band, through the admin bootstrap
 * endpoint, because the environment this project is developed in can only
 * make HTTPS requests and cannot open a TCP connection to Postgres. The
 * build host has no such restriction — so this is the one place in the
 * pipeline that can both see the migrations and reach the database.
 *
 * Doing it here also closes a real failure mode: code and schema ship
 * together. Adding a column to schema.prisma makes Prisma select that column
 * on every query, so deploying that code before its migration takes every
 * affected endpoint down until someone remembers to run the migration by
 * hand. That is exactly what happened when customFields was added.
 *
 * Behaviour is deliberately asymmetric:
 *   - No database URL at build time → skip, don't fail. Build-time
 *     availability of environment variables depends on how they're scoped in
 *     the host, and a preview build without database access should still
 *     produce a deployable artifact.
 *   - URL present but the migration fails → fail the build. Shipping code
 *     whose schema was not applied is the bug this script exists to prevent.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// apps/api owns the migration history; apps/web/prisma is a generation-only copy.
const schemaPath = resolve(here, '../../api/prisma/schema.prisma');

// Same precedence as resolveDatabaseUrl() in src/lib/server/env.ts — the host
// provisions this under several different names.
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.PRISMA_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

if (!databaseUrl) {
  console.warn('[migrate] No database URL available at build time — skipping migrate deploy.');
  process.exit(0);
}

// The pooling parameters the runtime appends are meaningless to the migration
// engine, and prisma:// style URLs cannot be migrated against directly.
if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  console.warn('[migrate] Database URL is not a direct Postgres connection — skipping migrate deploy.');
  process.exit(0);
}

console.log('[migrate] Applying pending migrations…');

try {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy', '--schema', schemaPath], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  console.log('[migrate] Done.');
} catch {
  console.error('[migrate] Migration failed — failing the build rather than deploying code whose schema is not applied.');
  process.exit(1);
}
