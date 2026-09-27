import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { ReplaceUserRolesDto } from './dto/replace-user-roles.dto';
import { RolesService } from './roles.service';

@Controller('organizations/:organizationId/users/:userId/roles')
@UseGuards(TenantAccessGuard, PermissionGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class RoleAssignmentsController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('settings.read', 'users.read')
  list(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    void _organizationId;
    return this.service.listUserRoles(userId);
  }

  @Put()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('settings.update', 'users.update')
  replace(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() data: ReplaceUserRolesDto,
  ) {
    void _organizationId;
    return this.service.replaceUserRoles(userId, data);
  }
}
