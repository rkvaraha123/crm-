import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { PageDto } from '../common/dto/page.dto';
import { RolesService } from './roles.service';
@Controller('organizations/:organizationId/roles')
@UseGuards(TenantAccessGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class RolesController {
  constructor(private readonly service: RolesService) {}
  @Get()
  @Access({
    kind: 'tenant',
    parameter: 'organizationId',
    permission: 'settings.read',
  })
  list(
    @Param('organizationId', ParseUUIDPipe) _id: string,
    @Query() page: PageDto,
  ) {
    void _id;
    return this.service.list(page);
  }
}
