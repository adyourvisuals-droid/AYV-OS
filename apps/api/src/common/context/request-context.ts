import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The ambient context for the current request.
 *
 * This exists so tenant scoping does not depend on every developer remembering
 * to pass `organizationId` into every query. The guard populates it once; the
 * Prisma middleware reads it on every operation. A service that forgets to
 * filter by tenant still produces a tenant-scoped query.
 */
export interface RequestContext {
  requestId: string;
  organizationId?: string;
  userId?: string;
  /** Set only for portal users — hard-scopes reads to a single client. */
  clientId?: string;
  roleKey?: string;
  permissions?: string[];
  actorType?: 'USER' | 'AI_AGENT' | 'SYSTEM' | 'AUTOMATION';
  agentKey?: string;
  ipAddress?: string;
  userAgent?: string;
  /**
   * Escape hatch for operations that legitimately cross tenants: the login
   * lookup, platform-level cron jobs, migrations. Must be set deliberately.
   */
  skipTenantScope?: boolean;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const RequestContextStore = {
  run<T>(context: RequestContext, callback: () => T): T {
    return storage.run(context, callback);
  },

  get(): RequestContext | undefined {
    return storage.getStore();
  },

  /** Mutate the active context — used by guards as the principal resolves. */
  patch(patch: Partial<RequestContext>): void {
    const current = storage.getStore();
    if (current) Object.assign(current, patch);
  },

  getOrganizationId(): string | undefined {
    return storage.getStore()?.organizationId;
  },

  getUserId(): string | undefined {
    return storage.getStore()?.userId;
  },

  /**
   * Run a callback with tenant scoping disabled. Deliberately verbose —
   * every call site should be obvious in review.
   */
  runUnscoped<T>(callback: () => T): T {
    const current = storage.getStore();
    return storage.run({ ...(current ?? { requestId: 'system' }), skipTenantScope: true }, callback);
  },
};
