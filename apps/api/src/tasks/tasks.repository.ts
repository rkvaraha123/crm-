import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ActivitySubjectType,
  ActivityType,
  CustomFieldEntity,
  TaskStatus,
  TaskSubjectType,
} from '@prisma/client';
import { RecordScopeService } from '../authorization/record-scope.service';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { CrmConfigurationService } from '../configuration/crm-configuration.service';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const assigneeSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

@Injectable()
export class TasksRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
    private readonly recordScope: RecordScopeService,
    private readonly configuration: CrmConfigurationService,
  ) {}

  async list(query: ListTasksDto) {
    const organizationId = this.context.requireOrganization();
    const access = await this.recordScope.taskWhere();
    return this.prisma.task.findMany({
      where: {
        organizationId,
        ...access,
        archivedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
        ...(query.search
          ? {
              OR: [
                {
                  title: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  description: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      take: query.limit,
      skip: query.offset,
      orderBy: [
        { completedAt: 'asc' },
        { dueAt: 'asc' },
        { createdAt: 'desc' },
        { id: 'asc' },
      ],
      include: { assignee: { select: assigneeSelect } },
    });
  }

  async find(id: string) {
    const access = await this.recordScope.taskWhere();
    return this.prisma.task.findFirstOrThrow({
      where: {
        id,
        organizationId: this.context.requireOrganization(),
        ...access,
        archivedAt: null,
      },
      include: { assignee: { select: assigneeSelect } },
    });
  }

  private async assertSubject(
    subjectType?: TaskSubjectType,
    subjectId?: string,
  ) {
    if (!subjectType && !subjectId) return;
    if (!subjectType || !subjectId)
      throw new BadRequestException(
        'Task subject type and subject id must be provided together',
      );

    const organizationId = this.context.requireOrganization();
    if (subjectType === TaskSubjectType.COMPANY) {
      const access = await this.recordScope.companyWhere();
      const row = await this.prisma.company.findFirst({
        where: { id: subjectId, organizationId, ...access, archivedAt: null },
        select: { id: true },
      });
      if (!row) throw new BadRequestException('Invalid task company');
      return;
    }
    if (subjectType === TaskSubjectType.CONTACT) {
      const access = await this.recordScope.contactWhere();
      const row = await this.prisma.contact.findFirst({
        where: { id: subjectId, organizationId, ...access, archivedAt: null },
        select: { id: true },
      });
      if (!row) throw new BadRequestException('Invalid task contact');
      return;
    }
    if (subjectType === TaskSubjectType.LEAD) {
      const access = await this.recordScope.leadWhere();
      const row = await this.prisma.lead.findFirst({
        where: { id: subjectId, organizationId, ...access, archivedAt: null },
        select: { id: true },
      });
      if (!row) throw new BadRequestException('Invalid task lead');
      return;
    }
    const access = await this.recordScope.dealWhere();
    const row = await this.prisma.deal.findFirst({
      where: { id: subjectId, organizationId, ...access, archivedAt: null },
      select: { id: true },
    });
    if (!row) throw new BadRequestException('Invalid task deal');
  }

  async create(data: CreateTaskDto) {
    await this.assertSubject(data.subjectType, data.subjectId);
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const customFields = await this.configuration.validateCustomValues(
      CustomFieldEntity.TASK,
      data.customFields,
    );
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          organizationId,
          assigneeId: context.userId,
          title: data.title,
          description: data.description,
          dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
          priority: data.priority,
          subjectType: data.subjectType,
          subjectId: data.subjectId,
          customFields,
        },
        include: { assignee: { select: assigneeSelect } },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.TASK,
          subjectId: task.id,
          type: ActivityType.TASK_CREATED,
        },
      });
      return task;
    });
  }

  async update(id: string, data: UpdateTaskDto) {
    const existing = await this.find(id);
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const customFields =
      data.customFields === undefined
        ? undefined
        : await this.configuration.validateCustomValues(
            CustomFieldEntity.TASK,
            data.customFields,
          );
    const completedAt =
      data.status === TaskStatus.COMPLETED
        ? (existing.completedAt ?? new Date())
        : data.status === undefined
          ? undefined
          : null;

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          description: data.description,
          dueAt:
            data.dueAt === null
              ? null
              : data.dueAt
                ? new Date(data.dueAt)
                : undefined,
          priority: data.priority,
          status: data.status,
          completedAt,
          ...(customFields === undefined ? {} : { customFields }),
        },
        include: { assignee: { select: assigneeSelect } },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.TASK,
          subjectId: task.id,
          type:
            data.status === TaskStatus.COMPLETED
              ? ActivityType.TASK_COMPLETED
              : ActivityType.TASK_UPDATED,
          metadata: { fields: Object.keys(data) },
        },
      });
      return task;
    });
  }

  async assign(id: string, data: AssignTaskDto) {
    const existing = await this.find(id);
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: data.assigneeId,
        },
      },
      select: { status: true },
    });
    if (membership?.status !== 'ACTIVE')
      throw new BadRequestException('Task assignee must be an active member');

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id: existing.id },
        data: { assigneeId: data.assigneeId },
        include: { assignee: { select: assigneeSelect } },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.TASK,
          subjectId: task.id,
          type: ActivityType.TASK_UPDATED,
          metadata: { fields: ['assigneeId'] },
        },
      });
      return task;
    });
  }

  async archive(id: string) {
    const existing = await this.find(id);
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id: existing.id },
        data: { archivedAt: new Date() },
        include: { assignee: { select: assigneeSelect } },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.TASK,
          subjectId: task.id,
          type: ActivityType.TASK_ARCHIVED,
        },
      });
      return task;
    });
  }
}
