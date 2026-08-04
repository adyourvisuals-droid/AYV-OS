/**
 * Syncs the permission registry and system role matrix into the database as
 * part of the deployment build.
 *
 * Permissions and system roles are defined in code (packages/types), but the
 * authorisation check reads them from the database. That split has the same
 * ship-ahead-of-data hazard as an unapplied migration: adding a permission to
 * the registry and gating a route on it deploys a route nobody can call,
 * because no role has been granted something that does not exist yet as a
 * row. Adding CUSTOM_FIELD_MANAGE did exactly that — Super Admin could open
 * the custom fields screen but not create a field.
 *
 * The sync is additive and idempotent:
 *   - every permission in the registry is ensured to exist
 *   - every system role is ensured to exist, for every organisation
 *   - grants a system role is missing are filled in
 *
 * It never removes a grant. Revoking is a deliberate act performed through
 * the roles editor, and a deploy should not quietly undo it. Custom
 * (non-system) roles are left alone entirely — they belong to the user.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.PRISMA_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

if (!databaseUrl) {
  console.warn('[rbac] No database URL available at build time — skipping RBAC sync.');
  process.exit(0);
}

const { ALL_PERMISSIONS, SYSTEM_ROLES } = require('@ayv/types');
const { PrismaClient } = require(resolve(here, '../generated/prisma'));

// The generated client is used directly rather than through src/lib/server/db,
// which applies tenant scoping from an request context that does not exist here.
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

async function main() {
  await prisma.permission.createMany({
    data: ALL_PERMISSIONS.map((key) => ({
      id: randomUUID(),
      key,
      domain: key.split(':')[0],
    })),
    skipDuplicates: true,
  });

  const permissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permissionIdByKey = new Map(permissions.map((row) => [row.key, row.id]));
  console.log(`[rbac] ${permissions.length} permissions present.`);

  const organizations = await prisma.organization.findMany({ select: { id: true } });
  if (organizations.length === 0) {
    console.log('[rbac] No organisations yet — nothing to sync. The bootstrap endpoint seeds the first one.');
    return;
  }

  let rolesCreated = 0;
  let grantsAdded = 0;

  for (const organization of organizations) {
    const existingRoles = await prisma.role.findMany({
      where: { organizationId: organization.id },
      select: { id: true, key: true },
    });
    const roleIdByKey = new Map(existingRoles.map((row) => [row.key, row.id]));

    for (const definition of SYSTEM_ROLES) {
      let roleId = roleIdByKey.get(definition.key);

      if (!roleId) {
        const created = await prisma.role.create({
          data: {
            organizationId: organization.id,
            key: definition.key,
            name: definition.name,
            description: definition.description,
            isSystem: true,
            level: definition.level,
          },
          select: { id: true },
        });
        roleId = created.id;
        rolesCreated += 1;
      }

      const desired = new Map();
      const grants =
        definition.permissions === '*'
          ? ALL_PERMISSIONS.map((permission) => ({ permission, scope: 'ALL' }))
          : definition.permissions;
      for (const grant of grants) desired.set(grant.permission, grant.scope ?? 'ALL');

      const held = await prisma.rolePermission.findMany({
        where: { roleId },
        select: { permission: { select: { key: true } } },
      });
      const heldKeys = new Set(held.map((row) => row.permission.key));

      const missing = [];
      for (const [key, scope] of desired) {
        if (heldKeys.has(key)) continue;
        const permissionId = permissionIdByKey.get(key);
        if (permissionId) missing.push({ roleId, permissionId, scope });
      }

      if (missing.length > 0) {
        await prisma.rolePermission.createMany({ data: missing, skipDuplicates: true });
        grantsAdded += missing.length;
      }
    }
  }

  console.log(
    `[rbac] ${organizations.length} organisation(s): ${rolesCreated} role(s) created, ${grantsAdded} grant(s) added.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    await prisma.$disconnect().catch(() => {});
    console.error('[rbac] Sync failed — failing the build rather than deploying routes nobody can call.');
    console.error(error);
    process.exit(1);
  });
