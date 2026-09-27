import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RecordResource, RecordScope } from '@prisma/client';
import { RolesRepository } from './roles.repository';
import { PageDto } from '../common/dto/page.dto';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { AuthorizationAuditService } from '../authorization/authorization-audit.service';
import { RecordScopeService } from '../authorization/record-scope.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { ReplaceUserRolesDto } from './dto/replace-user-roles.dto';
import { UpdateRoleRecordScopesDto } from './dto/update-role-record-scopes.dto';
import { ROLE_PERMISSIONS } from './default-roles';

const isReservedRoleName = (name: string) =>
  Object.hasOwn(ROLE_PERMISSIONS, name.toUpperCase());
@Injectable()
export class RolesService {
  constructor(
    private readonly repository: RolesRepository,
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuthorizationAuditService,
    private readonly recordScope: RecordScopeService,
  ) {}
  list(page: PageDto) {
    return this.repository.list(page);
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  effectivePermissions() {
    const context = this.context.current();
    return this.authorization
      .getEffectivePermissions(
        context.userId,
        this.context.requireOrganization(),
      )
      .then((permissions) => ({ permissions }));
  }

  async create(data: CreateRoleDto) {
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    if (isReservedRoleName(data.name))
      throw new ConflictException('Role name is reserved');
    const role = await this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.role.findUnique({
        where: { organizationId_name: { organizationId, name: data.name } },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Role name already exists');
      const permissions = await this.authorization.validatePermissionSelection(
        tx,
        context.userId,
        organizationId,
        data.permissionIds,
      );
      return tx.role.create({
        data: {
          organizationId,
          name: data.name,
          description: data.description,
          isSystem: false,
          permissions: {
            create: permissions.map(({ id }) => ({ permissionId: id })),
          },
          recordScopes: {
            create: [
              {
                resource: RecordResource.COMPANIES,
                scope: RecordScope.OWN,
              },
              {
                resource: RecordResource.CONTACTS,
                scope: RecordScope.OWN,
              },
            ],
          },
        },
        include: {
          permissions: { select: { permission: true } },
          recordScopes: true,
        },
      });
    });
    this.audit.record({
      action: 'ROLE_CREATED',
      actorUserId: context.userId,
      organizationId,
      targetId: role.id,
    });
    return role;
  }

  async update(roleId: string, data: UpdateRoleDto) {
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    if (data.name && isReservedRoleName(data.name))
      throw new ConflictException('Role name is reserved');
    const role = await this.prisma.$transaction(async (tx) => {
      await this.authorization.assertRoleMutable(
        tx,
        roleId,
        organizationId,
        context.userId,
      );
      if (data.name) {
        const duplicate = await tx.role.findFirst({
          where: { organizationId, name: data.name, id: { not: roleId } },
          select: { id: true },
        });
        if (duplicate) throw new ConflictException('Role name already exists');
      }
      return tx.role.update({ where: { id: roleId }, data });
    });
    this.audit.record({
      action: 'ROLE_UPDATED',
      actorUserId: context.userId,
      organizationId,
      targetId: role.id,
    });
    return role;
  }

  async replacePermissions(roleId: string, data: UpdateRolePermissionsDto) {
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const role = await this.prisma.$transaction(async (tx) => {
      await this.authorization.assertRoleMutable(
        tx,
        roleId,
        organizationId,
        context.userId,
      );
      const permissions = await this.authorization.validatePermissionSelection(
        tx,
        context.userId,
        organizationId,
        data.permissionIds,
      );
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: permissions.map(({ id }) => ({ roleId, permissionId: id })),
      });
      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: {
          permissions: { select: { permission: true } },
          recordScopes: true,
        },
      });
    });
    this.audit.record({
      action: 'ROLE_PERMISSIONS_CHANGED',
      actorUserId: context.userId,
      organizationId,
      targetId: role.id,
    });
    return role;
  }

  async replaceRecordScopes(
    roleId: string,
    data: UpdateRoleRecordScopesDto,
  ) {
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const role = await this.prisma.$transaction(async (tx) => {
      await this.authorization.assertRoleMutable(
        tx,
        roleId,
        organizationId,
        context.userId,
      );
      const requested = [
        {
          resource: RecordResource.COMPANIES,
          scope: data.companies,
        },
        {
          resource: RecordResource.CONTACTS,
          scope: data.contacts,
        },
      ] as const;

      for (const { resource, scope } of requested) {
        if (
          !(await this.recordScope.canGrant(
            context.userId,
            organizationId,
            resource,
            scope,
            tx,
          ))
        ) {
          throw new ForbiddenException('Record scope assignment denied');
        }
        await tx.roleRecordScope.upsert({
          where: { roleId_resource: { roleId, resource } },
          create: { roleId, resource, scope },
          update: { scope },
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: {
          permissions: { select: { permission: true } },
          recordScopes: true,
        },
      });
    });
    this.audit.record({
      action: 'ROLE_RECORD_SCOPES_CHANGED',
      actorUserId: context.userId,
      organizationId,
      targetId: role.id,
    });
    return role;
  }

  async remove(roleId: string) {
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    await this.prisma.$transaction(async (tx) => {
      await this.authorization.assertRoleMutable(
        tx,
        roleId,
        organizationId,
        context.userId,
      );
      if ((await tx.userRole.count({ where: { roleId, organizationId } })) > 0)
        throw new ConflictException('Assigned role cannot be deleted');
      await tx.role.delete({ where: { id: roleId } });
    });
    this.audit.record({
      action: 'ROLE_DELETED',
      actorUserId: context.userId,
      organizationId,
      targetId: roleId,
    });
    return { deleted: true };
  }

  async listUserRoles(userId: string) {
    const organizationId = this.context.requireOrganization();
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Organization member not found');
    return this.prisma.userRole.findMany({
      where: { organizationId, userId, role: { organizationId } },
      orderBy: { role: { name: 'asc' } },
      select: { role: { select: { id: true, name: true, isSystem: true } } },
    });
  }

  async replaceUserRoles(userId: string, data: ReplaceUserRolesDto) {
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const result = await this.prisma.$transaction(async (tx) => {
      const roles = await this.authorization.validateRoleAssignment(
        tx,
        context.userId,
        userId,
        organizationId,
        data.roleIds,
      );
      const current = await tx.userRole.findMany({
        where: { organizationId, userId, role: { organizationId } },
        select: { roleId: true },
      });
      await tx.userRole.deleteMany({
        where: { organizationId, userId, role: { organizationId } },
      });
      await tx.userRole.createMany({
        data: roles.map(({ id }) => ({ organizationId, userId, roleId: id })),
      });
      return { current: current.map(({ roleId }) => roleId), roles };
    });
    const next = new Set(result.roles.map(({ id }) => id));
    const previous = new Set(result.current);
    for (const roleId of previous)
      if (!next.has(roleId))
        this.audit.record({
          action: 'ROLE_REMOVED',
          actorUserId: context.userId,
          organizationId,
          targetId: `${userId}:${roleId}`,
        });
    for (const roleId of next)
      if (!previous.has(roleId))
        this.audit.record({
          action: 'ROLE_ASSIGNED',
          actorUserId: context.userId,
          organizationId,
          targetId: `${userId}:${roleId}`,
        });
    return this.listUserRoles(userId);
  }
}
