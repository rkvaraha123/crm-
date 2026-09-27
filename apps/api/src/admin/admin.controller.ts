import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CrmModuleKey } from '@prisma/client';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { UpdateOrganizationAppearanceDto } from '../organizations/dto/update-organization-appearance.dto';
import { CrmConfigurationService } from '../configuration/crm-configuration.service';
import { CreateCustomFieldDto } from '../configuration/dto/create-custom-field.dto';
import { CreatePipelineDto } from '../configuration/dto/create-pipeline.dto';
import { CreatePipelineStageDto } from '../configuration/dto/create-pipeline-stage.dto';
import { ListCustomFieldsDto } from '../configuration/dto/list-custom-fields.dto';
import { UpdateCrmModuleDto } from '../configuration/dto/update-crm-module.dto';
import { UpdateCustomFieldDto } from '../configuration/dto/update-custom-field.dto';
import { UpdatePipelineDto } from '../configuration/dto/update-pipeline.dto';
import { UpdatePipelineStageDto } from '../configuration/dto/update-pipeline-stage.dto';
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
  constructor(
    private readonly service: AdminService,
    private readonly configuration: CrmConfigurationService,
  ) {}

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


  @Get('organizations/:organizationId/modules')
  modules(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.configuration.listModules(organizationId);
  }

  @Patch('organizations/:organizationId/modules/:key')
  updateModule(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('key', new ParseEnumPipe(CrmModuleKey)) key: CrmModuleKey,
    @Body() data: UpdateCrmModuleDto,
  ) {
    return this.configuration.updateModule(organizationId, key, data);
  }

  @Get('organizations/:organizationId/custom-fields')
  customFields(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() query: ListCustomFieldsDto,
  ) {
    return this.configuration.listCustomFields(
      organizationId,
      query.entity,
      false,
    );
  }

  @Post('organizations/:organizationId/custom-fields')
  createCustomField(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() data: CreateCustomFieldDto,
  ) {
    return this.configuration.createCustomField(organizationId, data);
  }

  @Patch('organizations/:organizationId/custom-fields/:fieldId')
  updateCustomField(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Body() data: UpdateCustomFieldDto,
  ) {
    return this.configuration.updateCustomField(organizationId, fieldId, data);
  }

  @Delete('organizations/:organizationId/custom-fields/:fieldId')
  disableCustomField(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
  ) {
    return this.configuration.disableCustomField(organizationId, fieldId);
  }

  @Get('organizations/:organizationId/pipelines')
  pipelines(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.configuration.listPipelines(organizationId);
  }

  @Post('organizations/:organizationId/pipelines')
  createPipeline(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() data: CreatePipelineDto,
  ) {
    return this.configuration.createPipeline(organizationId, data);
  }

  @Patch('organizations/:organizationId/pipelines/:pipelineId')
  updatePipeline(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @Body() data: UpdatePipelineDto,
  ) {
    return this.configuration.updatePipeline(
      organizationId,
      pipelineId,
      data,
    );
  }

  @Post('organizations/:organizationId/pipelines/:pipelineId/stages')
  createPipelineStage(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @Body() data: CreatePipelineStageDto,
  ) {
    return this.configuration.createStage(organizationId, pipelineId, data);
  }

  @Patch(
    'organizations/:organizationId/pipelines/:pipelineId/stages/:stageId',
  )
  updatePipelineStage(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() data: UpdatePipelineStageDto,
  ) {
    return this.configuration.updateStage(
      organizationId,
      pipelineId,
      stageId,
      data,
    );
  }

  @Delete(
    'organizations/:organizationId/pipelines/:pipelineId/stages/:stageId',
  )
  disablePipelineStage(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
  ) {
    return this.configuration.disableStage(
      organizationId,
      pipelineId,
      stageId,
    );
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
