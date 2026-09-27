import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/database/prisma.service';
import type { PermissionKey } from '../permissions/default-permissions';

type DatabaseClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async isPlatformAdmin(userId: string) {
    return (
      (await this.prisma.userRole.findFirst({
        where: {
          userId,
          membership: {
            status: 'ACTIVE',
            organization: { status: 'ACTIVE' },
            user: { status: 'ACTIVE' },
          },
          role: {
            organizationId: null,
            name: 'SUPER_ADMIN',
            isSystem: true,
          },
        },
        select: { id: true },
      })) !== null
    );
  }

  async getEffectivePermissions(
    userId: string,
    organizationId: string,
    database: DatabaseClient = this.prisma,
  ): Promise<PermissionKey[]> {
    const assignments = await database.userRole.findMany({
      where: {
        userId,
        organizationId,
        membership: {
          status: 'ACTIVE',
          organization: { status: 'ACTIVE' },
          user: { status: 'ACTIVE' },
        },
        role: {
          OR: [{ organizationId }, { organizationId: null }],
        },
      },
      select: {
        role: {
          select: {
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    });
    return [
      ...new Set(
        assignments.flatMap(({ role }) =>
          role.permissions.map(
            ({ permission }) => permission.key as PermissionKey,
          ),
        ),
      ),
    ].sort();
  }

  async hasAllPermissions(
    userId: string,
    organizationId: string,
    required: readonly PermissionKey[],
  ) {
    const effective = new Set(
      await this.getEffectivePermissions(userId, organizationId),
    );
    return required.every((permission) => effective.has(permission));
  }

  async hasAnyPermission(
    userId: string,
    organizationId: string,
    required: readonly PermissionKey[],
  ) {
    const effective = new Set(
      await this.getEffectivePermissions(userId, organizationId),
    );
    return required.some((permission) => effective.has(permission));
  }

  async validateRoleAssignment(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    targetUserId: string,
    organizationId: string,
    roleIds: readonly string[],
  ) {
    if (actorUserId === targetUserId)
      throw new ForbiddenException('Role assignment denied');
    if (new Set(roleIds).size !== roleIds.length)
      throw new BadRequestException(
        'Duplicate role assignments are not allowed',
      );
    const membership = await tx.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
      select: { status: true },
    });
    if (!membership || !['ACTIVE', 'INVITED'].includes(membership.status))
      throw new NotFoundException('Organization member not found');
    const roles = await tx.role.findMany({
      where: { id: { in: [...roleIds] }, organizationId },
      select: {
        id: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    if (roles.length !== roleIds.length)
      throw new BadRequestException('One or more roles are not assignable');
    const actorPermissions = new Set(
      await this.getEffectivePermissions(actorUserId, organizationId, tx),
    );
    if (
      roles.some((role) =>
        role.permissions.some(
          ({ permission }) =>
            !actorPermissions.has(permission.key as PermissionKey),
        ),
      )
    )
      throw new ForbiddenException('Role assignment denied');
    return roles;
  }

  async validatePermissionSelection(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    organizationId: string,
    permissionIds: readonly string[],
  ) {
    if (new Set(permissionIds).size !== permissionIds.length)
      throw new BadRequestException('Duplicate permissions are not allowed');
    const permissions = await tx.permission.findMany({
      where: { id: { in: [...permissionIds] } },
      select: { id: true, key: true },
    });
    if (permissions.length !== permissionIds.length)
      throw new BadRequestException('One or more permissions are invalid');
    const actorPermissions = new Set(
      await this.getEffectivePermissions(actorUserId, organizationId, tx),
    );
    if (
      permissions.some(({ key }) => !actorPermissions.has(key as PermissionKey))
    )
      throw new ForbiddenException('Permission assignment denied');
    return permissions;
  }

  async assertRoleMutable(
    tx: Prisma.TransactionClient,
    roleId: string,
    organizationId: string,
    actorUserId: string,
  ) {
    const role = await tx.role.findFirst({
      where: { id: roleId, organizationId },
      select: {
        id: true,
        isSystem: true,
        userRoles: {
          where: { organizationId, userId: actorUserId },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem || role.userRoles.length > 0)
      throw new ForbiddenException('Protected role cannot be modified');
    return role;
  }
}
