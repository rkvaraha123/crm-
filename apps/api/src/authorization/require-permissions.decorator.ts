import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../permissions/default-permissions';

export const REQUIRED_PERMISSIONS = 'required-permissions';

export interface PermissionRequirement {
  mode: 'all' | 'any';
  permissions: readonly PermissionKey[];
}

export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, {
    mode: 'all',
    permissions,
  } satisfies PermissionRequirement);

export const RequireAnyPermission = (...permissions: PermissionKey[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, {
    mode: 'any',
    permissions,
  } satisfies PermissionRequirement);
