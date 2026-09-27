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
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { DealsService } from './deals.service';

@Controller('organizations/:organizationId')
@UseGuards(TenantAccessGuard, PermissionGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class DealsController {
  constructor(private readonly service: DealsService) {}

  @Get('pipelines')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('deals.read')
  pipelines(@Param('organizationId', ParseUUIDPipe) _organizationId: string) {
    void _organizationId;
    return this.service.listPipelines();
  }

  @Get('deals')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('deals.read')
  list(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Query('search') search?: string,
  ) {
    void _organizationId;
    return this.service.list(search?.trim());
  }

  @Post('deals')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('deals.create')
  create(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Body() data: CreateDealDto,
  ) {
    void _organizationId;
    return this.service.create(data);
  }

  @Patch('deals/:dealId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('deals.update')
  update(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('dealId', ParseUUIDPipe) dealId: string,
    @Body() data: UpdateDealDto,
  ) {
    void _organizationId;
    return this.service.update(dealId, data);
  }

  @Delete('deals/:dealId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('deals.delete')
  archive(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('dealId', ParseUUIDPipe) dealId: string,
  ) {
    void _organizationId;
    return this.service.archive(dealId);
  }
}
