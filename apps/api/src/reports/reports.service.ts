import { Injectable } from '@nestjs/common';
import { DealStatus, RecordResource, TaskStatus } from '@prisma/client';
import { RecordScopeService } from '../authorization/record-scope.service';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
    private readonly recordScope: RecordScopeService,
  ) {}

  private async hasScope(resource: RecordResource) {
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    return (
      (await this.recordScope.getEffectiveRecordScope(
        context.userId,
        organizationId,
        resource,
      )) !== null
    );
  }

  async summary() {
    const organizationId = this.context.requireOrganization();
    const [hasCompanies, hasContacts, hasLeads, hasDeals, hasTasks] =
      await Promise.all([
        this.hasScope(RecordResource.COMPANIES),
        this.hasScope(RecordResource.CONTACTS),
        this.hasScope(RecordResource.LEADS),
        this.hasScope(RecordResource.DEALS),
        this.hasScope(RecordResource.TASKS),
      ]);

    const companyWhere = hasCompanies
      ? await this.recordScope.companyWhere()
      : null;
    const contactWhere = hasContacts
      ? await this.recordScope.contactWhere()
      : null;
    const leadWhere = hasLeads ? await this.recordScope.leadWhere() : null;
    const dealWhere = hasDeals ? await this.recordScope.dealWhere() : null;
    const taskWhere = hasTasks ? await this.recordScope.taskWhere() : null;

    const [
      companies,
      contacts,
      leads,
      deals,
      openDealValue,
      wonDealValue,
      tasks,
      overdueTasks,
      completedTasks,
    ] = await Promise.all([
      companyWhere
        ? this.prisma.company.count({
            where: { organizationId, ...companyWhere, archivedAt: null },
          })
        : 0,
      contactWhere
        ? this.prisma.contact.count({
            where: { organizationId, ...contactWhere, archivedAt: null },
          })
        : 0,
      leadWhere
        ? this.prisma.lead.count({
            where: { organizationId, ...leadWhere, archivedAt: null },
          })
        : 0,
      dealWhere
        ? this.prisma.deal.count({
            where: { organizationId, ...dealWhere, archivedAt: null },
          })
        : 0,
      dealWhere
        ? this.prisma.deal.aggregate({
            where: {
              organizationId,
              ...dealWhere,
              archivedAt: null,
              status: DealStatus.OPEN,
            },
            _sum: { amount: true },
          })
        : null,
      dealWhere
        ? this.prisma.deal.aggregate({
            where: {
              organizationId,
              ...dealWhere,
              archivedAt: null,
              status: DealStatus.WON,
            },
            _sum: { amount: true },
          })
        : null,
      taskWhere
        ? this.prisma.task.count({
            where: { organizationId, ...taskWhere, archivedAt: null },
          })
        : 0,
      taskWhere
        ? this.prisma.task.count({
            where: {
              organizationId,
              ...taskWhere,
              archivedAt: null,
              dueAt: { lt: new Date() },
              status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
            },
          })
        : 0,
      taskWhere
        ? this.prisma.task.count({
            where: {
              organizationId,
              ...taskWhere,
              archivedAt: null,
              status: TaskStatus.COMPLETED,
            },
          })
        : 0,
    ]);

    return {
      companies,
      contacts,
      leads,
      deals,
      openDealValue: openDealValue?._sum.amount?.toString() ?? '0',
      wonDealValue: wonDealValue?._sum.amount?.toString() ?? '0',
      tasks,
      overdueTasks,
      completedTasks,
    };
  }

  async leadFunnel() {
    const organizationId = this.context.requireOrganization();
    if (!(await this.hasScope(RecordResource.LEADS))) return [];
    const access = await this.recordScope.leadWhere();
    const rows = await this.prisma.lead.groupBy({
      by: ['status'],
      where: { organizationId, ...access, archivedAt: null },
      _count: { _all: true },
      orderBy: { status: 'asc' },
    });
    return rows.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));
  }

  async pipeline() {
    const organizationId = this.context.requireOrganization();
    if (!(await this.hasScope(RecordResource.DEALS))) return [];
    const access = await this.recordScope.dealWhere();
    const [groups, stages] = await Promise.all([
      this.prisma.deal.groupBy({
        by: ['pipelineId', 'stageId', 'currency'],
        where: {
          organizationId,
          ...access,
          archivedAt: null,
          status: DealStatus.OPEN,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.pipelineStage.findMany({
        where: { organizationId },
        select: {
          id: true,
          pipelineId: true,
          name: true,
          position: true,
          pipeline: { select: { name: true } },
        },
      }),
    ]);

    const stageMap = new Map(stages.map((stage) => [stage.id, stage]));
    return groups
      .map((row) => {
        const stage = stageMap.get(row.stageId);
        return {
          pipelineId: row.pipelineId,
          pipelineName: stage?.pipeline.name ?? 'Pipeline',
          stageId: row.stageId,
          stageName: stage?.name ?? 'Stage',
          stagePosition: stage?.position ?? 0,
          currency: row.currency,
          deals: row._count._all,
          value: row._sum.amount?.toString() ?? '0',
        };
      })
      .sort(
        (a, b) =>
          a.pipelineName.localeCompare(b.pipelineName) ||
          a.stagePosition - b.stagePosition,
      );
  }
}
