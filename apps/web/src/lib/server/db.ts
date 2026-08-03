// Generated to a custom local path (see prisma/schema.prisma) rather than
// the shared `@prisma/client` resolution, so it can never collide with
// apps/api's independently-generated client of the same package version.
import { PrismaClient } from '../../../generated/prisma';

import { resolveDatabaseUrl } from './env';

/**
 * Prisma Client singleton.
 *
 * In dev, Next.js hot-reloads route modules on every save, which would
 * otherwise create a new PrismaClient (and a new connection pool) per
 * reload. Stashing it on `globalThis` survives the reload. In serverless
 * production this matters less — each cold start gets a fresh instance
 * regardless — but the guard is harmless there too.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Explicit, because the deployment host names this variable
    // PRISMA_DATABASE_URL / POSTGRES_URL rather than the DATABASE_URL that
    // schema.prisma declares. Undefined falls back to the schema's own
    // env() lookup, which is correct for local development.
    datasourceUrl: resolveDatabaseUrl(),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
