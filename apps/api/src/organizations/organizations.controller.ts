import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { PageDto } from '../common/dto/page.dto';
import { UpdateOrganizationAppearanceDto } from './dto/update-organization-appearance.dto';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
@Controller('organizations')
@UseGuards(TenantAccessGuard, PermissionGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}
  @Post()
  @Access({ kind: 'system' })
  create(@Body() data: CreateOrganizationDto) {
    return this.service.create(data);
  }
  @Get(':id')
  @Access({ kind: 'tenant', parameter: 'id' })
  @RequirePermissions('organizations.read')
  find(@Param('id', ParseUUIDPipe) _id: string) {
    void _id;
    return this.service.findCurrent();
  }

  @Get(':organizationId/appearance')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  getAppearance(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
  ) {
    void _organizationId;
    return this.service.getAppearance();
  }

  @Put(':organizationId/appearance')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('settings.update')
  updateAppearance(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Body() data: UpdateOrganizationAppearanceDto,
  ) {
    void _organizationId;
    return this.service.updateAppearance(data);
  }

  @Delete(':organizationId/appearance')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('settings.update')
  resetAppearance(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
  ) {
    void _organizationId;
    return this.service.resetAppearance();
  }

  @Post(':organizationId/members')
  @Access({
    kind: 'tenant',
    parameter: 'organizationId',
  })
  @RequirePermissions('users.invite')
  createMember(
    @Param('organizationId', ParseUUIDPipe) _id: string,
    @Body() data: CreateMemberDto,
  ) {
    void _id;
    return this.service.createMember(data);
  }
  @Get(':organizationId/members')
  @Access({
    kind: 'tenant',
    parameter: 'organizationId',
  })
  @RequirePermissions('users.read')
  listMembers(
    @Param('organizationId', ParseUUIDPipe) _id: string,
    @Query() page: PageDto,
  ) {
    void _id;
    return this.service.listMembers(page);
  }
}
