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
import { CrmModuleKey } from '@prisma/client';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { OrganizationContextInterceptor } from '../common/tenant/organization-context.interceptor';
import { Access } from '../common/tenant/tenant-access.decorator';
import { TenantAccessGuard } from '../common/tenant/tenant-access.guard';
import { CrmModuleGuard } from '../configuration/crm-module.guard';
import { RequireCrmModule } from '../configuration/require-crm-module.decorator';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('organizations/:organizationId/tasks')
@RequireCrmModule(CrmModuleKey.TASKS)
@UseGuards(TenantAccessGuard, CrmModuleGuard, PermissionGuard)
@UseInterceptors(OrganizationContextInterceptor)
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('tasks.read')
  list(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Query() query: ListTasksDto,
  ) {
    void _organizationId;
    return this.service.list(query);
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

  @Get(':taskId')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('tasks.read')
  find(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    void _organizationId;
    return this.service.find(taskId);
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

  @Patch(':taskId/assignee')
  @Access({ kind: 'tenant', parameter: 'organizationId' })
  @RequirePermissions('tasks.assign')
  assign(
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() data: AssignTaskDto,
  ) {
    void _organizationId;
    return this.service.assign(taskId, data);
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
