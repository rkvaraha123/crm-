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
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller('organizations/:organizationId/contacts')
@UseGuards(TenantAccessGuard, PermissionGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  @Get()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('contacts.read')
  list(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Query() query: ListContactsDto,
  ) {
    void _organizationId;
    return this.service.list(query);
  }

  @Post()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('contacts.create')
  create(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Body() data: CreateContactDto,
  ) {
    void _organizationId;
    return this.service.create(data);
  }

  @Get(':contactId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('contacts.read')
  find(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    void _organizationId;
    return this.service.find(contactId);
  }

  @Patch(':contactId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('contacts.update')
  update(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() data: UpdateContactDto,
  ) {
    void _organizationId;
    return this.service.update(contactId, data);
  }

  @Delete(':contactId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('contacts.delete')
  archive(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    void _organizationId;
    return this.service.archive(contactId);
  }
}
