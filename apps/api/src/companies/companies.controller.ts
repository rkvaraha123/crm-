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
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('organizations/:organizationId/companies')
@UseGuards(TenantAccessGuard, PermissionGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  @Get()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('companies.read')
  list(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Query() query: ListCompaniesDto,
  ) {
    void _organizationId;
    return this.service.list(query);
  }

  @Post()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('companies.create')
  create(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Body() data: CreateCompanyDto,
  ) {
    void _organizationId;
    return this.service.create(data);
  }

  @Get(':companyId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('companies.read')
  find(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    void _organizationId;
    return this.service.find(companyId);
  }

  @Patch(':companyId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('companies.update')
  update(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() data: UpdateCompanyDto,
  ) {
    void _organizationId;
    return this.service.update(companyId, data);
  }

  @Delete(':companyId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('companies.delete')
  archive(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    void _organizationId;
    return this.service.archive(companyId);
  }
}
