import type { Prisma } from '@prisma/client';
import {
  ensurePermissions,
  PERMISSION_KEYS,
  PermissionKey,
} from '../permissions/default-permissions';
const sales = PERMISSION_KEYS.filter((key) =>
  ['contacts', 'companies', 'leads', 'deals', 'tasks'].includes(
    key.split('.')[0],
  ),
);
const reads = PERMISSION_KEYS.filter(
  (key) =>
    key.endsWith('.read') &&
    !['settings.read', 'audit_logs.read'].includes(key),
);
export const ROLE_PERMISSIONS: Record<string, readonly PermissionKey[]> = {
  SUPER_ADMIN: PERMISSION_KEYS,
  ORG_ADMIN: PERMISSION_KEYS,
  MANAGER: [
    ...sales,
    'organizations.read',
    'users.read',
    'teams.read',
    'reports.read',
    'reports.export',
  ],
  TEAM_LEAD: [...sales, 'users.read', 'teams.read', 'reports.read'],
  SALES: sales,
  MARKETING: [
    'contacts.read',
    'contacts.create',
    'contacts.update',
    'companies.read',
    'leads.read',
    'leads.create',
    'leads.update',
    'tasks.read',
    'tasks.create',
    'reports.read',
  ],
  SUPPORT: [
    'contacts.read',
    'companies.read',
    'tasks.read',
    'tasks.create',
    'tasks.update',
  ],
  VIEWER: reads,
};
async function mapPermissions(
  tx: Prisma.TransactionClient,
  roleId: string,
  keys: readonly PermissionKey[],
  permissions: { id: string; key: string }[],
) {
  await tx.rolePermission.createMany({
    data: permissions
      .filter((permission) => keys.includes(permission.key as PermissionKey))
      .map((permission) => ({ roleId, permissionId: permission.id })),
    skipDuplicates: true,
  });
}
export async function createDefaultRoles(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  const permissions = await ensurePermissions(tx);
  for (const [name, keys] of Object.entries(ROLE_PERMISSIONS)) {
    if (name === 'SUPER_ADMIN') continue;
    const role = await tx.role.upsert({
      where: { organizationId_name: { organizationId, name } },
      create: {
        organizationId,
        name,
        description: `Default ${name} role`,
        isSystem: true,
      },
      update: {},
    });
    await mapPermissions(tx, role.id, keys, permissions);
  }
}
export async function seedFoundation(tx: Prisma.TransactionClient) {
  const organization = await tx.organization.upsert({
    where: { slug: 'rk-varaha-dev' },
    create: { name: 'RK Varaha Development', slug: 'rk-varaha-dev' },
    update: {},
  });
  await createDefaultRoles(tx, organization.id);
  const permissions = await ensurePermissions(tx);
  let globalRole = await tx.role.findFirst({
    where: { organizationId: null, name: 'SUPER_ADMIN' },
  });
  globalRole ??= await tx.role.create({
    data: {
      name: 'SUPER_ADMIN',
      isSystem: true,
      description:
        'Global system role; tenant assignments still require membership',
    },
  });
  await mapPermissions(
    tx,
    globalRole.id,
    ROLE_PERMISSIONS.SUPER_ADMIN,
    permissions,
  );
  return organization;
}
