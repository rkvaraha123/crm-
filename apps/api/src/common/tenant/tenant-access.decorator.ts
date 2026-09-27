import { SetMetadata } from '@nestjs/common';
export const ACCESS_POLICY = 'tenant-access-policy';
export type AccessPolicy =
  | { kind: 'system' }
  | { kind: 'self' }
  | {
      kind: 'tenant';
      parameter: 'id' | 'organizationId';
    };
export const Access = (policy: AccessPolicy) =>
  SetMetadata(ACCESS_POLICY, policy);
