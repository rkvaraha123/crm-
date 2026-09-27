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
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { ListDealsDto } from './dto/list-deals.dto';
import { MoveDealStageDto } from './dto/move-deal-stage.dto';
import { UpdateDealDto } from './dto/update-deal.dto';

@Controller('organizations/:organizationId/deals')
@RequireCrmModule(CrmModuleKey.DEALS)
@UseGuards(TenantAccessGuard, CrmModuleGuard, PermissionGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class DealsController {
  constructor(private readonly service: DealsService) {}

  @Get('pipelines')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('deals.read')
  pipelines(@Param('organizationId', ParseUUIDPipe) _organizationId: string) {
    void _organizationId;
    return this.service.pipelines();
  }

  @Get()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('deals.read')
  list(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Query() query: ListDealsDto,
  ) {
    void _organizationId;
    return this.service.list(query);
  }

  @Post()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('deals.create')
  create(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Body() data: CreateDealDto,
  ) {
    void _organizationId;
    return this.service.create(data);
  }

  @Get(':dealId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('deals.read')
  find(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('dealId', ParseUUIDPipe) dealId: string,
  ) {
    void _organizationId;
    return this.service.find(dealId);
  }

  @Patch(':dealId')
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

  @Patch(':dealId/stage')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('deals.update')
  moveStage(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('dealId', ParseUUIDPipe) dealId: string,
    @Body() data: MoveDealStageDto,
  ) {
    void _organizationId;
    return this.service.moveStage(dealId, data);
  }

  @Delete(':dealId')
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
