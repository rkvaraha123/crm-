import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
  Body,
  Post,
} from '@nestjs/common';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { PageDto } from '../common/dto/page.dto';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
@Controller('organizations/:organizationId/teams')
@UseGuards(TenantAccessGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class TeamsController {
  constructor(private readonly service: TeamsService) {}
  @Get()
  @Access({
    kind: 'tenant',
    parameter: 'organizationId',
    permission: 'teams.read',
  })
  list(
    @Param('organizationId', ParseUUIDPipe) _id: string,
    @Query() page: PageDto,
  ) {
    void _id;
    return this.service.list(page);
  }
  @Post()
  @Access({
    kind: 'tenant',
    parameter: 'organizationId',
    permission: 'teams.create',
  })
  create(
    @Param('organizationId', ParseUUIDPipe) _id: string,
    @Body() data: CreateTeamDto,
  ) {
    void _id;
    return this.service.create(data);
  }
}
