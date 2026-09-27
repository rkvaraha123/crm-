import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { AssignLeadDto } from './dto/assign-lead.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@Controller('organizations/:organizationId/leads')
@RequireCrmModule(CrmModuleKey.LEADS)
@UseGuards(TenantAccessGuard, CrmModuleGuard, PermissionGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @Get()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('leads.read')
  list(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Query() query: ListLeadsDto,
  ) {
    void _organizationId;
    return this.service.list(query);
  }

  @Post()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('leads.create')
  create(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Body() data: CreateLeadDto,
  ) {
    void _organizationId;
    return this.service.create(data);
  }

  @Get(':leadId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('leads.read')
  find(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('leadId', ParseUUIDPipe) leadId: string,
  ) {
    void _organizationId;
    return this.service.find(leadId);
  }

  @Patch(':leadId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('leads.update')
  update(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() data: UpdateLeadDto,
  ) {
    void _organizationId;
    return this.service.update(leadId, data);
  }

  @Patch(':leadId/owner')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('leads.assign')
  assign(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() data: AssignLeadDto,
  ) {
    void _organizationId;
    return this.service.assign(leadId, data);
  }

  @Delete(':leadId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('leads.delete')
  archive(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('leadId', ParseUUIDPipe) leadId: string,
  ) {
    void _organizationId;
    return this.service.archive(leadId);
  }
}
