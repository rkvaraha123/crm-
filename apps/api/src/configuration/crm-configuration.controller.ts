import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CrmModuleKey, CustomFieldEntity } from '@prisma/client';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { CrmConfigurationService } from './crm-configuration.service';
import { ListCustomFieldsDto } from './dto/list-custom-fields.dto';

@Controller('organizations/:organizationId/config')
@UseGuards(TenantAccessGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class CrmConfigurationController {
  constructor(private readonly configuration: CrmConfigurationService) {}

  @Get('modules')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  modules(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
  ) {
    void _organizationId;
    return this.configuration.listModules();
  }

  @Get('custom-fields')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  customFields(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Query() query: ListCustomFieldsDto,
  ) {
    void _organizationId;
    return this.configuration.listTenantCustomFields(query.entity);
  }

  @Get('module/:key')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  async module(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('key', new ParseEnumPipe(CrmModuleKey)) key: CrmModuleKey,
  ) {
    void _organizationId;
    return { key, enabled: await this.configuration.isEnabled(key) };
  }

  @Get('custom-fields/:entity')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  fieldsForEntity(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('entity', new ParseEnumPipe(CustomFieldEntity))
    entity: CustomFieldEntity,
  ) {
    void _organizationId;
    return this.configuration.listTenantCustomFields(entity);
  }
}
