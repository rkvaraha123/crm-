import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ContextRequest,
  VERIFIED_CONTEXT,
} from '../common/tenant/tenant-access.guard';
import { AuthorizationService } from './authorization.service';
import {
  PermissionRequirement,
  REQUIRED_PERMISSIONS,
} from './require-permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(execution: ExecutionContext) {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(
      REQUIRED_PERMISSIONS,
      [execution.getHandler(), execution.getClass()],
    );
    if (!requirement || requirement.permissions.length === 0) return true;
    const context = execution.switchToHttp().getRequest<ContextRequest>()[
      VERIFIED_CONTEXT
    ];
    if (!context?.organizationId)
      throw new ForbiddenException('Organization authorization required');
    const allowed =
      requirement.mode === 'all'
        ? await this.authorization.hasAllPermissions(
            context.userId,
            context.organizationId,
            requirement.permissions,
          )
        : await this.authorization.hasAnyPermission(
            context.userId,
            context.organizationId,
            requirement.permissions,
          );
    if (!allowed) throw new ForbiddenException('Permission denied');
    return true;
  }
}
