/**
 * Lazily-read server configuration.
 *
 * Reading `process.env` at module top-level would throw during `next build`
 * if a secret isn't present at build time (Vercel makes Production env vars
 * available at runtime, but build-time availability depends on which
 * environments they're scoped to). Every access here happens inside a
 * function, only when a request actually needs it, so a missing secret
 * surfaces as a clean 500 on first use instead of failing the deployment.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in Vercel → Project → Settings → Environment Variables.`,
    );
  }
  return value;
}

/**
 * The database connection string, under whichever name the host provides it.
 *
 * Prisma's Vercel integration provisions `PRISMA_DATABASE_URL` and
 * `POSTGRES_URL` — not `DATABASE_URL`, which is what prisma/schema.prisma
 * declares and what local development uses. Reading only `DATABASE_URL`
 * meant every database call on Vercel failed with "Environment variable not
 * found", which surfaced to the browser as an unparseable HTML error page.
 *
 * Returns undefined rather than throwing so module-level Prisma Client
 * construction can't break the build; a missing URL then fails at query
 * time, where it's caught and reported as JSON.
 */
export function resolveDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.PRISMA_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    undefined
  );
}

export const authEnv = {
  get accessSecret(): string {
    return requireEnv('JWT_ACCESS_SECRET');
  },
  get refreshSecret(): string {
    return requireEnv('JWT_REFRESH_SECRET');
  },
  get accessExpiresIn(): string {
    return process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  },
  get refreshExpiresIn(): string {
    return process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  },
};
