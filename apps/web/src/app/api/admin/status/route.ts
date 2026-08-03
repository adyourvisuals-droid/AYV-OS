import { resolveDatabaseUrl } from '@/lib/server/env';
import { successResponse } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Deployment and configuration diagnostics.
 *
 * Reports which commit is actually serving traffic and which environment
 * variables are present — the two things that are otherwise invisible from
 * outside the platform, and which caused a long misdiagnosis when the host
 * turned out to provide PRISMA_DATABASE_URL rather than DATABASE_URL.
 *
 * Deliberately unauthenticated but secret-free: it returns booleans for
 * variable presence and the database *host* only. No values, no
 * credentials, nothing that isn't already implied by the deployment
 * existing.
 */
export async function GET() {
  const databaseUrl = resolveDatabaseUrl();

  let databaseHost: string | null = null;
  if (databaseUrl) {
    try {
      databaseHost = new URL(databaseUrl).host;
    } catch {
      databaseHost = 'unparseable';
    }
  }

  return successResponse({
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown',
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'unknown',
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    databaseConfigured: Boolean(databaseUrl),
    databaseHost,
    envPresent: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      PRISMA_DATABASE_URL: Boolean(process.env.PRISMA_DATABASE_URL),
      POSTGRES_URL: Boolean(process.env.POSTGRES_URL),
      JWT_ACCESS_SECRET: Boolean(process.env.JWT_ACCESS_SECRET),
      JWT_REFRESH_SECRET: Boolean(process.env.JWT_REFRESH_SECRET),
      BOOTSTRAP_SECRET: Boolean(process.env.BOOTSTRAP_SECRET),
    },
    // Length only, never the value — lets us confirm a pasted secret matches
    // what was intended without ever exposing it. Trailing whitespace from a
    // copy/paste is a common, otherwise invisible cause of "invalid secret".
    bootstrapSecretLength: process.env.BOOTSTRAP_SECRET?.length ?? null,
  });
}
