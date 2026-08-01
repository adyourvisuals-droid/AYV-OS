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
