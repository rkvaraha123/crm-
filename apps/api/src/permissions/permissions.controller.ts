import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { RolesService } from '../roles/roles.service';
import { RecordScopeService } from '../authorization/record-scope.service';

@Controller('organizations/:organizationId')
@UseGuards(TenantAccessGuard, PermissionGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class PermissionsController {
  constructor(
    private readonly roles: RolesService,
    private readonly recordScopeService: RecordScopeService,
  ) {}

  @Get('me/permissions')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  effective(@Param('organizationId', ParseUUIDPipe) _organizationId: string) {
    void _organizationId;
    return this.roles.effectivePermissions();
  }

  @Get('me/record-scopes')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  recordScopes(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
  ) {
    void _organizationId;
    return this.recordScopeService.effectiveScopes();
  }

  @Get('permissions')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('settings.read')
  catalog(@Param('organizationId', ParseUUIDPipe) _organizationId: string) {
    void _organizationId;
    return this.roles.listPermissions();
  }
}
