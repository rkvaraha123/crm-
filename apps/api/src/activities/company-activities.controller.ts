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
import { ActivitySubjectType } from '@prisma/client';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { PageDto } from '../common/dto/page.dto';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { ActivitiesService } from './activities.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Controller('organizations/:organizationId/companies/:companyId')
@UseGuards(TenantAccessGuard, PermissionGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class CompanyActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get('activities')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('activities.read')
  list(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() page: PageDto,
  ) {
    void _organizationId;
    return this.service.list(ActivitySubjectType.COMPANY, companyId, page);
  }

  @Post('notes')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('notes.create')
  createNote(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() data: CreateNoteDto,
  ) {
    void _organizationId;
    return this.service.createNote(
      ActivitySubjectType.COMPANY,
      companyId,
      data.body,
    );
  }

  @Patch('notes/:activityId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('notes.update')
  updateNote(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() data: UpdateNoteDto,
  ) {
    void _organizationId;
    return this.service.updateNote(
      ActivitySubjectType.COMPANY,
      companyId,
      activityId,
      data.body,
    );
  }

  @Delete('notes/:activityId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('notes.delete')
  archiveNote(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
  ) {
    void _organizationId;
    return this.service.archiveNote(
      ActivitySubjectType.COMPANY,
      companyId,
      activityId,
    );
  }
}
