import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CrmModuleKey } from '@prisma/client';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { CrmModuleGuard } from '../configuration/crm-module.guard';
import { RequireCrmModule } from '../configuration/require-crm-module.decorator';
import { ReportsService } from './reports.service';

@Controller('organizations/:organizationId/reports')
@RequireCrmModule(CrmModuleKey.REPORTS)
@UseGuards(TenantAccessGuard, CrmModuleGuard, PermissionGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('summary')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('reports.read')
  summary(@Param('organizationId', ParseUUIDPipe) _organizationId: string) {
    void _organizationId;
    return this.service.summary();
  }

  @Get('lead-funnel')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('reports.read')
  leadFunnel(@Param('organizationId', ParseUUIDPipe) _organizationId: string) {
    void _organizationId;
    return this.service.leadFunnel();
  }

  @Get('pipeline')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('reports.read')
  pipeline(@Param('organizationId', ParseUUIDPipe) _organizationId: string) {
    void _organizationId;
    return this.service.pipeline();
  }
}
