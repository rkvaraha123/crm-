import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('organizations/:organizationId/tasks')
@UseGuards(TenantAccessGuard, PermissionGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('tasks.read')
  list(@Param('organizationId', ParseUUIDPipe) _organizationId: string) {
    void _organizationId;
    return this.service.list();
  }

  @Post()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('tasks.create')
  create(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Body() data: CreateTaskDto,
  ) {
    void _organizationId;
    return this.service.create(data);
  }

  @Patch(':taskId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('tasks.update')
  update(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() data: UpdateTaskDto,
  ) {
    void _organizationId;
    return this.service.update(taskId, data);
  }

  @Delete(':taskId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('tasks.delete')
  archive(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    void _organizationId;
    return this.service.archive(taskId);
  }
}
