import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthorizationService } from './authorization.service';
import { PermissionGuard } from './permission.guard';
import type { PermissionRequirement } from './require-permissions.decorator';
import { VERIFIED_CONTEXT } from '../common/tenant/tenant-access.guard';

describe('PermissionGuard', () => {
  function setup(requirement: PermissionRequirement, allowed: boolean) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requirement),
    } as unknown as Reflector;
    const authorization = {
      hasAllPermissions: jest.fn().mockResolvedValue(allowed),
      hasAnyPermission: jest.fn().mockResolvedValue(allowed),
    } as unknown as AuthorizationService;
    const request = {
      [VERIFIED_CONTEXT]: {
        userId: 'user-id',
        organizationId: 'organization-id',
        systemAdmin: false,
      },
    };
    const execution = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
    return {
      guard: new PermissionGuard(reflector, authorization),
      authorization,
      execution,
    };
  }

  it('uses ALL-required evaluation by default', async () => {
    const { guard, authorization, execution } = setup(
      { mode: 'all', permissions: ['settings.update', 'users.update'] },
      true,
    );
    await expect(guard.canActivate(execution)).resolves.toBe(true);
    expect(authorization.hasAllPermissions).toHaveBeenCalledWith(
      'user-id',
      'organization-id',
      ['settings.update', 'users.update'],
    );
    expect(authorization.hasAnyPermission).not.toHaveBeenCalled();
  });

  it('uses explicit ANY evaluation and fails closed', async () => {
    const { guard, authorization, execution } = setup(
      { mode: 'any', permissions: ['teams.update', 'teams.delete'] },
      false,
    );
    await expect(guard.canActivate(execution)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(authorization.hasAnyPermission).toHaveBeenCalledWith(
      'user-id',
      'organization-id',
      ['teams.update', 'teams.delete'],
    );
  });
});
