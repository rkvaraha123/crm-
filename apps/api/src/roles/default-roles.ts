import { RecordResource, RecordScope, type Prisma } from '@prisma/client';
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
const collaboration: readonly PermissionKey[] = [
  'activities.read',
  'notes.create',
  'notes.update',
  'notes.delete',
];

export const ROLE_PERMISSIONS: Record<string, readonly PermissionKey[]> = {
  SUPER_ADMIN: PERMISSION_KEYS,
  ORG_ADMIN: PERMISSION_KEYS,
  MANAGER: [
    ...sales,
    ...collaboration,
    'organizations.read',
    'users.read',
    'teams.read',
    'reports.read',
    'reports.export',
  ],
  TEAM_LEAD: [
    ...sales,
    ...collaboration,
    'users.read',
    'teams.read',
    'reports.read',
  ],
  SALES: [...sales, ...collaboration],
  MARKETING: [
    'contacts.read',
    'contacts.create',
    'contacts.update',
    'companies.read',
    'activities.read',
    'notes.create',
    'notes.update',
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
    'activities.read',
    'notes.create',
    'notes.update',
    'tasks.read',
    'tasks.create',
    'tasks.update',
  ],
  VIEWER: reads,
};

const ROLE_SCOPE: Record<string, RecordScope> = {
  SUPER_ADMIN: RecordScope.ORGANIZATION,
  ORG_ADMIN: RecordScope.ORGANIZATION,
  MANAGER: RecordScope.ORGANIZATION,
  TEAM_LEAD: RecordScope.TEAM,
  SALES: RecordScope.OWN,
  MARKETING: RecordScope.ORGANIZATION,
  SUPPORT: RecordScope.ORGANIZATION,
  VIEWER: RecordScope.ORGANIZATION,
};

const RECORD_RESOURCES = [
  RecordResource.COMPANIES,
  RecordResource.CONTACTS,
  RecordResource.LEADS,
  RecordResource.DEALS,
  RecordResource.TASKS,
] as const;

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

async function mapRecordScopes(
  tx: Prisma.TransactionClient,
  roleId: string,
  roleName: string,
) {
  const scope = ROLE_SCOPE[roleName];
  if (!scope) return;
  for (const resource of RECORD_RESOURCES) {
    await tx.roleRecordScope.upsert({
      where: { roleId_resource: { roleId, resource } },
      create: { roleId, resource, scope },
      update: { scope },
    });
  }
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
    await mapRecordScopes(tx, role.id, name);
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
  await mapRecordScopes(tx, globalRole.id, 'SUPER_ADMIN');
  return organization;
}
