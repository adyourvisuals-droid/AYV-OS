import { Prisma, PrismaClient } from '../../../generated/prisma';

import { RequestContextStore } from './request-context';

/**
 * Ported from apps/api/src/infra/prisma/prisma.extensions.ts, adapted to
 * import the client from the custom output path (see prisma/schema.prisma)
 * instead of `@prisma/client`. Behaviour is otherwise identical: tenant
 * isolation and soft delete are enforced at the Prisma Client level, not by
 * developer discipline in each route handler.
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

export function createPrismaClient(databaseUrl: string | undefined) {
  const base = new PrismaClient({
    datasourceUrl: databaseUrl,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  return base.$extends(softDeleteExtension(base)).$extends(tenantExtension());
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;
