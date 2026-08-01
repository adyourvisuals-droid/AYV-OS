import { Prisma, PrismaClient } from '@prisma/client';

import { RequestContextStore } from '@/common/context/request-context';

/**
 * Models that carry `organizationId`, and models that carry `deletedAt`,
 * derived from the generated DMMF rather than hand-maintained lists.
 *
 * Adding a model to schema.prisma automatically opts it into tenant scoping
 * and soft delete — there is no list to forget to update.
 */
const TENANT_SCOPED_MODELS = new Set<string>();
const SOFT_DELETE_MODELS = new Set<string>();

for (const model of Prisma.dmmf.datamodel.models) {
  const fieldNames = new Set(model.fields.map((field) => field.name));
  if (fieldNames.has('organizationId')) TENANT_SCOPED_MODELS.add(model.name);
  if (fieldNames.has('deletedAt')) SOFT_DELETE_MODELS.add(model.name);
}

const READ_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

const WHERE_SCOPED_WRITE_OPERATIONS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);

type AnyArgs = Record<string, any>;

function mergeWhere(args: AnyArgs, filter: AnyArgs): AnyArgs {
  return { ...args, where: { ...(args.where ?? {}), ...filter } };
}

function currentTenantFilter(model: string): AnyArgs {
  const context = RequestContextStore.get();
  if (context?.skipTenantScope) return {};
  if (!context?.organizationId) return {};
  if (!TENANT_SCOPED_MODELS.has(model)) return {};
  return { organizationId: context.organizationId };
}

/**
 * Tenant isolation.
 *
 * Reads and scoped writes get `organizationId` injected into the where clause;
 * creates get it injected into the data payload. Prisma's extended
 * where-unique support means this works uniformly for `findUnique`, `update`
 * and `delete` as well as the plural operations.
 *
 * Nested writes are not rewritten — an extension only observes top-level args —
 * so a nested `create` must set `organizationId` itself. Prisma's own types
 * enforce that, since the column is non-nullable.
 */
function tenantExtension() {
  return Prisma.defineExtension({
    name: 'ayv-tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenantFilter = currentTenantFilter(model);
          if (Object.keys(tenantFilter).length === 0) return query(args);

          const nextArgs = (args ?? {}) as AnyArgs;

          if (READ_OPERATIONS.has(operation) || WHERE_SCOPED_WRITE_OPERATIONS.has(operation)) {
            return query(mergeWhere(nextArgs, tenantFilter));
          }

          if (operation === 'create') {
            return query({ ...nextArgs, data: { ...tenantFilter, ...(nextArgs.data ?? {}) } });
          }

          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const data = nextArgs.data;
            const withTenant = Array.isArray(data)
              ? data.map((row: AnyArgs) => ({ ...tenantFilter, ...row }))
              : { ...tenantFilter, ...(data ?? {}) };
            return query({ ...nextArgs, data: withTenant });
          }

          if (operation === 'upsert') {
            return query({
              ...mergeWhere(nextArgs, tenantFilter),
              create: { ...tenantFilter, ...(nextArgs.create ?? {}) },
            } as typeof args);
          }

          return query(args);
        },
      },
    },
  });
}

/**
 * Soft delete.
 *
 * `delete` and `deleteMany` become timestamp updates, and every read excludes
 * soft-deleted rows unless the caller explicitly filters on `deletedAt` —
 * which is how restore flows and `?deleted=true` opt back in.
 *
 * The rewrite runs against the *base* client rather than re-entering the
 * extended one, so it cannot recurse. Because that bypasses the tenant
 * extension, the tenant filter is re-applied here explicitly; merging it twice
 * is harmless, and it keeps this correct regardless of extension ordering.
 */
function softDeleteExtension(base: PrismaClient) {
  return Prisma.defineExtension({
    name: 'ayv-soft-delete',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!SOFT_DELETE_MODELS.has(model)) return query(args);

          const nextArgs = (args ?? {}) as AnyArgs;
          const delegate = (base as unknown as Record<string, any>)[
            model.charAt(0).toLowerCase() + model.slice(1)
          ];

          if (operation === 'delete' || operation === 'deleteMany') {
            const where = { ...(nextArgs.where ?? {}), ...currentTenantFilter(model) };
            const data = { deletedAt: new Date() };
            return operation === 'delete'
              ? delegate.update({ where, data })
              : delegate.updateMany({ where, data });
          }

          if (READ_OPERATIONS.has(operation)) {
            // An explicit `deletedAt` filter means the caller is deliberately
            // asking for deleted rows; never override it.
            const callerFilteredDeleted =
              nextArgs.where && Object.prototype.hasOwnProperty.call(nextArgs.where, 'deletedAt');

            if (!callerFilteredDeleted) {
              return query(mergeWhere(nextArgs, { deletedAt: null }));
            }
          }

          return query(args);
        },
      },
    },
  });
}

export function createPrismaClient(databaseUrl: string) {
  const base = new PrismaClient({
    datasourceUrl: databaseUrl,
    log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
  });

  return base.$extends(softDeleteExtension(base)).$extends(tenantExtension());
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;
