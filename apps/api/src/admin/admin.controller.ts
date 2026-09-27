import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { UpdateOrganizationAppearanceDto } from '../organizations/dto/update-organization-appearance.dto';
import { UpdateOrganizationProductConfigDto } from '../organizations/dto/update-organization-product-config.dto';
import { AdminService } from './admin.service';
import { ListAdminOrganizationsDto } from './dto/list-admin-organizations.dto';
import { ListAdminUsersDto } from './dto/list-admin-users.dto';
import { UpdateOrganizationStatusDto } from './dto/update-organization-status.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Controller('admin')
@UseGuards(TenantAccessGuard)
@UseInterceptors(OrganizationContextInterceptor)
@Access({ kind: 'system' })
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('me')
  me() {
    return this.service.me();
  }

  @Get('overview')
  overview() {
    return this.service.overview();
  }

  @Get('organizations')
  organizations(@Query() query: ListAdminOrganizationsDto) {
    return this.service.listOrganizations(query);
  }

  @Patch('organizations/:organizationId/status')
  updateOrganizationStatus(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() data: UpdateOrganizationStatusDto,
  ) {
    return this.service.updateOrganizationStatus(organizationId, data.status);
  }

  @Get('organizations/:organizationId/product-config')
  getProductConfig(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.service.getProductConfig(organizationId);
  }

  @Put('organizations/:organizationId/product-config')
  updateProductConfig(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() data: UpdateOrganizationProductConfigDto,
  ) {
    return this.service.updateProductConfig(organizationId, data);
  }

  @Get('organizations/:organizationId/appearance')
  getAppearance(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.service.getAppearance(organizationId);
  }

  @Put('organizations/:organizationId/appearance')
  updateAppearance(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() data: UpdateOrganizationAppearanceDto,
  ) {
    return this.service.updateAppearance(organizationId, data);
  }

  @Delete('organizations/:organizationId/appearance')
  resetAppearance(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.service.resetAppearance(organizationId);
  }

  @Get('users')
  users(@Query() query: ListAdminUsersDto) {
    return this.service.listUsers(query);
  }

  @Patch('users/:userId/status')
  updateUserStatus(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() data: UpdateUserStatusDto,
  ) {
    return this.service.updateUserStatus(userId, data.status);
  }
}
