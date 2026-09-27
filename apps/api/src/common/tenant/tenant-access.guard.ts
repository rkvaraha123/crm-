import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { IdentityProvider } from '../../auth/identity.provider';
import { PrismaService } from '../database/prisma.service';
import { ACCESS_POLICY, AccessPolicy } from './tenant-access.decorator';
import type { OrganizationContext } from './organization-context.service';
import { AuthorizationService } from '../../authorization/authorization.service';
export const VERIFIED_CONTEXT = Symbol('verified-organization-context');
export type ContextRequest = Request & {
  [VERIFIED_CONTEXT]?: OrganizationContext;
};
@Injectable()
export class TenantAccessGuard implements CanActivate {
  constructor(
    private readonly identities: IdentityProvider,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}
  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const request = execution.switchToHttp().getRequest<ContextRequest>();
    const identity = await this.identities.resolve(request);
    if (!identity || !isUUID(identity.userId))
      throw new UnauthorizedException('Verified authentication is required');
    const user = await this.prisma.user.findUnique({
      where: { id: identity.userId },
      select: { status: true },
    });
    if (user?.status !== 'ACTIVE')
      throw new ForbiddenException('Active user required');
    const policy = this.reflector.getAllAndOverride<AccessPolicy>(
      ACCESS_POLICY,
      [execution.getHandler(), execution.getClass()],
    );
    if (!policy) throw new ForbiddenException('Access policy required');
    const systemAdmin =
      policy.kind !== 'tenant' &&
      (identity.systemAdmin ||
        (await this.authorization.isPlatformAdmin(identity.userId)));
    const context: OrganizationContext = {
      userId: identity.userId,
      systemAdmin,
      identityProviderId: identity.identityProviderId,
    };
    if (policy.kind === 'system') {
      if (!systemAdmin)
        throw new ForbiddenException('System administrator required');
    } else if (policy.kind === 'self') {
      if (!isUUID(request.params.id as string))
        throw new BadRequestException('Invalid user UUID');
      if (request.params.id !== identity.userId && !systemAdmin)
        throw new ForbiddenException('User access denied');
    } else {
      if (!isUUID(request.params[policy.parameter] as string))
        throw new BadRequestException('Invalid organization UUID');
      const organizationId = request.headers['x-organization-id'];
      if (typeof organizationId !== 'string' || !isUUID(organizationId))
        throw new BadRequestException('Valid X-Organization-Id required');
      if (request.params[policy.parameter] !== organizationId)
        throw new ForbiddenException('Organization context mismatch');
      if (!isUUID(organizationId))
        throw new BadRequestException('Invalid organization UUID');
      const member = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: identity.userId },
        },
        include: {
          organization: { select: { status: true } },
        },
      });
      if (
        !member ||
        member.status !== 'ACTIVE' ||
        member.organization.status !== 'ACTIVE'
      )
        throw new ForbiddenException('Active organization membership required');
      context.organizationId = organizationId;
    }
    request[VERIFIED_CONTEXT] = Object.freeze(context);
    return true;
  }
}
