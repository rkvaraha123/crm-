import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
@Controller('organizations')
@UseGuards(TenantAccessGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}
  @Post()
  @Access({ kind: 'system' })
  create(@Body() data: CreateOrganizationDto) {
    return this.service.create(data);
  }
  @Get(':id')
  @Access({ kind: 'tenant', parameter: 'id', permission: 'organizations.read' })
  find(@Param('id', ParseUUIDPipe) _id: string) {
    void _id;
    return this.service.findCurrent();
  }
  @Post(':organizationId/members')
  @Access({
    kind: 'tenant',
    parameter: 'organizationId',
    permission: 'users.invite',
  })
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
    permission: 'users.read',
  })
  listMembers(
    @Param('organizationId', ParseUUIDPipe) _id: string,
    @Query() page: PageDto,
  ) {
    void _id;
    return this.service.listMembers(page);
  }
}
