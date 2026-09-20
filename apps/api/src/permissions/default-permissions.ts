import type { Prisma } from '@prisma/client';
export const PERMISSION_KEYS = [
  'organizations.read',
  'organizations.update',
  'users.read',
  'users.invite',
  'users.update',
  'users.disable',
  'teams.read',
  'teams.create',
  'teams.update',
  'teams.delete',
  'contacts.read',
  'contacts.create',
  'contacts.update',
  'contacts.delete',
  'companies.read',
  'companies.create',
  'companies.update',
  'companies.delete',
  'leads.read',
  'leads.create',
  'leads.update',
  'leads.assign',
  'leads.delete',
  'deals.read',
  'deals.create',
  'deals.update',
  'deals.delete',
  'tasks.read',
  'tasks.create',
  'tasks.update',
  'tasks.assign',
  'tasks.delete',
  'reports.read',
  'reports.export',
  'settings.read',
  'settings.update',
  'audit_logs.read',
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export async function ensurePermissions(tx: Prisma.TransactionClient) {
  await tx.permission.createMany({
    data: PERMISSION_KEYS.map((key) => ({
      key,
      description: key.replace('.', ': '),
    })),
    skipDuplicates: true,
  });
  return tx.permission.findMany({
    where: { key: { in: [...PERMISSION_KEYS] } },
  });
}
