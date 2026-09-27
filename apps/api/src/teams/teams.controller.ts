import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
  Post,
} from '@nestjs/common';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { PageDto } from '../common/dto/page.dto';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';

@Controller('organizations/:organizationId/teams')
@UseGuards(TenantAccessGuard, PermissionGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class TeamsController {
  constructor(private readonly service: TeamsService) {}

  @Get()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('teams.read')
  list(
    @Param('organizationId', ParseUUIDPipe) _id: string,
    @Query() page: PageDto,
  ) {
    void _id;
    return this.service.list(page);
  }

  @Post()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('teams.create')
  create(
    @Param('organizationId', ParseUUIDPipe) _id: string,
    @Body() data: CreateTeamDto,
  ) {
    void _id;
    return this.service.create(data);
  }

  @Get(':teamId/members')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('teams.read')
  listMembers(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() page: PageDto,
  ) {
    void _organizationId;
    return this.service.listMembers(teamId, page);
  }

  @Post(':teamId/members')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('teams.update')
  addMember(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() data: AddTeamMemberDto,
  ) {
    void _organizationId;
    return this.service.addMember(teamId, data.userId);
  }

  @Delete(':teamId/members/:userId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('teams.update')
  removeMember(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    void _organizationId;
    return this.service.removeMember(teamId, userId);
  }
}
