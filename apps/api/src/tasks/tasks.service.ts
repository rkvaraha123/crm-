import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  ActivitySubjectType,
  ActivityType,
  TaskStatus,
} from '@prisma/client';
import { RecordScopeService } from '../authorization/record-scope.service';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
    private readonly scopes: RecordScopeService,
  ) {}

  async list() {
    const organizationId = this.context.requireOrganization();
    const access = await this.scopes.taskWhere();
    return this.prisma.task.findMany({
      where: { organizationId, ...access, archivedAt: null },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 150,
      include: {
        creator: { select: userSelect },
        assignee: { select: userSelect },
        company: { select: { id: true, name: true } },
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        lead: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, name: true } },
      },
    });
  }

  private async assertMember(userId: string) {
    const organizationId = this.context.requireOrganization();
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { status: true, user: { select: { status: true } } },
    });
    if (!member || member.status !== 'ACTIVE' || member.user.status !== 'ACTIVE')
      throw new BadRequestException('Task assignee must be an active member');
  }

  private async validateReferences(data: {
    companyId?: string;
    contactId?: string;
    leadId?: string;
    dealId?: string;
  }) {
    const organizationId = this.context.requireOrganization();
    const checks = await Promise.all([
      data.companyId
        ? this.prisma.company.findFirst({
            where: { id: data.companyId, organizationId, archivedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
      data.contactId
        ? this.prisma.contact.findFirst({
            where: { id: data.contactId, organizationId, archivedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
      data.leadId
        ? this.prisma.lead.findFirst({
            where: { id: data.leadId, organizationId, archivedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
      data.dealId
        ? this.prisma.deal.findFirst({
            where: { id: data.dealId, organizationId, archivedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (
      (data.companyId && !checks[0]) ||
      (data.contactId && !checks[1]) ||
      (data.leadId && !checks[2]) ||
      (data.dealId && !checks[3])
    )
      throw new BadRequestException('Invalid related CRM record');
  }

  async find(id: string) {
    const access = await this.scopes.taskWhere();
    return this.prisma.task.findFirstOrThrow({
      where: {
        id,
        organizationId: this.context.requireOrganization(),
        ...access,
        archivedAt: null,
      },
    });
  }

  async create(data: CreateTaskDto) {
    const current = this.context.current();
    const organizationId = this.context.requireOrganization();
    const assigneeId = data.assigneeId ?? current.userId;
    await this.assertMember(assigneeId);
    await this.validateReferences(data);
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          organizationId,
          creatorId: current.userId,
          assigneeId,
          title: data.title,
          description: data.description,
          dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
          priority: data.priority,
          companyId: data.companyId,
          contactId: data.contactId,
          leadId: data.leadId,
          dealId: data.dealId,
        },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: current.userId,
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
    if (data.assigneeId) await this.assertMember(data.assigneeId);
    const current = this.context.current();
    const organizationId = this.context.requireOrganization();
    const completing =
      data.status === TaskStatus.COMPLETED &&
      existing.status !== TaskStatus.COMPLETED;
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id: existing.id },
        data: {
          ...data,
          dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
          completedAt: completing
            ? new Date()
            : data.status && data.status !== TaskStatus.COMPLETED
              ? null
              : undefined,
        },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: current.userId,
          subjectType: ActivitySubjectType.TASK,
          subjectId: task.id,
          type: completing
            ? ActivityType.TASK_COMPLETED
            : ActivityType.TASK_UPDATED,
          metadata: { fields: Object.keys(data) },
        },
      });
      return task;
    });
  }

  async archive(id: string) {
    const existing = await this.find(id);
    const current = this.context.current();
    const organizationId = this.context.requireOrganization();
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id: existing.id },
        data: { archivedAt: new Date() },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: current.userId,
          subjectType: ActivitySubjectType.TASK,
          subjectId: task.id,
          type: ActivityType.TASK_ARCHIVED,
        },
      });
      return task;
    });
  }
}
