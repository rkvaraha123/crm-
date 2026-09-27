import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { PageDto } from '../common/dto/page.dto';
import { RolesService } from './roles.service';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { UpdateRoleRecordScopesDto } from './dto/update-role-record-scopes.dto';
@Controller('organizations/:organizationId/roles')
@UseGuards(TenantAccessGuard, PermissionGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class RolesController {
  constructor(private readonly service: RolesService) {}
  @Get()
  @Access({
    kind: 'tenant',
    parameter: 'organizationId',
  })
  @RequirePermissions('settings.read')
  list(
    @Param('organizationId', ParseUUIDPipe) _id: string,
    @Query() page: PageDto,
  ) {
    void _id;
    return this.service.list(page);
  }

  @Post()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('settings.update')
  create(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Body() data: CreateRoleDto,
  ) {
    void _organizationId;
    return this.service.create(data);
  }

  @Patch(':roleId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('settings.update')
  update(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() data: UpdateRoleDto,
  ) {
    void _organizationId;
    return this.service.update(roleId, data);
  }

  @Put(':roleId/permissions')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('settings.update')
  replacePermissions(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() data: UpdateRolePermissionsDto,
  ) {
    void _organizationId;
    return this.service.replacePermissions(roleId, data);
  }

  @Put(':roleId/record-scopes')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('settings.update')
  replaceRecordScopes(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() data: UpdateRoleRecordScopesDto,
  ) {
    void _organizationId;
    return this.service.replaceRecordScopes(roleId, data);
  }

  @Delete(':roleId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('settings.update')
  remove(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    void _organizationId;
    return this.service.remove(roleId);
  }
}
