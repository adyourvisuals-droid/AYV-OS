import { resolveDatabaseUrl } from './env';
import { createPrismaClient, type ExtendedPrismaClient } from './prisma-extensions';

/**
 * Prisma Client singleton, extended with the same tenant-isolation and
 * soft-delete behaviour as apps/api's PrismaService (see
 * prisma-extensions.ts) — every read auto-excludes soft-deleted rows and,
 * once a request context is running (see require-auth.ts), auto-scopes to
 * the caller's organization.
 *
 * In dev, Next.js hot-reloads route modules on every save, which would
 * otherwise create a new PrismaClient (and a new connection pool) per
 * reload. Stashing it on `globalThis` survives the reload. In serverless
 * production this matters less — each cold start gets a fresh instance
 * regardless — but the guard is harmless there too.
 */
const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient(
    // Explicit, because the deployment host names this variable
    // PRISMA_DATABASE_URL / POSTGRES_URL rather than the DATABASE_URL that
    // schema.prisma declares. Undefined falls back to the schema's own
    // env() lookup, which is correct for local development.
    resolveDatabaseUrl(),
  );

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
