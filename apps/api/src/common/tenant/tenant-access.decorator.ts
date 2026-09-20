import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../../permissions/default-permissions';
export const ACCESS_POLICY = 'tenant-access-policy';
export type AccessPolicy =
  | { kind: 'system' }
  | { kind: 'self' }
  | {
      kind: 'tenant';
      parameter: 'id' | 'organizationId';
      permission: PermissionKey;
    };
export const Access = (policy: AccessPolicy) =>
  SetMetadata(ACCESS_POLICY, policy);
