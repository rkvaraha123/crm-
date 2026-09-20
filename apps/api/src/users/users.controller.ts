import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
@Controller('users')
@UseGuards(TenantAccessGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @Post()
  @Access({ kind: 'system' })
  create(@Body() data: CreateUserDto) {
    return this.service.create(data);
  }
  @Get(':id')
  @Access({ kind: 'self' })
  find(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.find(id);
  }
}
