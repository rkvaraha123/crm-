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
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@Controller('organizations/:organizationId/leads')
@UseGuards(TenantAccessGuard, PermissionGuard)
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
