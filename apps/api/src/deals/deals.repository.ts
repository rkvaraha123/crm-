import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ActivitySubjectType,
  ActivityType,
  CustomFieldEntity,
} from '@prisma/client';
import { RecordScopeService } from '../authorization/record-scope.service';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { CrmConfigurationService } from '../configuration/crm-configuration.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { ListDealsDto } from './dto/list-deals.dto';
import { MoveDealStageDto } from './dto/move-deal-stage.dto';
import { UpdateDealDto } from './dto/update-deal.dto';

const ownerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

const includeDeal = {
  owner: { select: ownerSelect },
  pipeline: { select: { id: true, name: true } },
  stage: {
    select: {
      id: true,
      name: true,
      position: true,
      probability: true,
      active: true,
    },
  },
  company: { select: { id: true, name: true } },
  contact: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

@Injectable()
export class DealsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
    private readonly recordScope: RecordScopeService,
    private readonly configuration: CrmConfigurationService,
  ) {}

  async list(query: ListDealsDto) {
    const organizationId = this.context.requireOrganization();
    const access = await this.recordScope.dealWhere();
    return this.prisma.deal.findMany({
      where: {
        organizationId,
        ...access,
        archivedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.pipelineId ? { pipelineId: query.pipelineId } : {}),
        ...(query.stageId ? { stageId: query.stageId } : {}),
        ...(query.search
          ? {
              OR: [
                {
                  name: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  company: {
                    name: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              ],
            }
          : {}),
      },
      take: query.limit,
      skip: query.offset,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      include: includeDeal,
    });
  }

  async find(id: string) {
    const access = await this.recordScope.dealWhere();
    return this.prisma.deal.findFirstOrThrow({
      where: {
        id,
        organizationId: this.context.requireOrganization(),
        ...access,
        archivedAt: null,
      },
      include: includeDeal,
    });
  }

  async pipelines() {
    const organizationId = this.context.requireOrganization();
    return this.prisma.pipeline.findMany({
      where: { organizationId, active: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        stages: {
          where: { active: true },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
        },
      },
    });
  }

  private async assertStage(pipelineId: string, stageId: string) {
    const organizationId = this.context.requireOrganization();
    const stage = await this.prisma.pipelineStage.findFirst({
      where: {
        id: stageId,
        pipelineId,
        organizationId,
        active: true,
        pipeline: { active: true },
      },
      select: { id: true, pipelineId: true, name: true },
    });
    if (!stage) throw new BadRequestException('Invalid pipeline stage');
    return stage;
  }

  private async assertCompany(companyId: string) {
    const access = await this.recordScope.companyWhere();
    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        organizationId: this.context.requireOrganization(),
        ...access,
        archivedAt: null,
      },
      select: { id: true },
    });
    if (!company) throw new BadRequestException('Invalid company');
  }

  private async assertContact(contactId: string) {
    const access = await this.recordScope.contactWhere();
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        organizationId: this.context.requireOrganization(),
        ...access,
        archivedAt: null,
      },
      select: { id: true },
    });
    if (!contact) throw new BadRequestException('Invalid contact');
  }

  async create(data: CreateDealDto) {
    await this.assertStage(data.pipelineId, data.stageId);
    if (data.companyId) await this.assertCompany(data.companyId);
    if (data.contactId) await this.assertContact(data.contactId);

    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const customFields = await this.configuration.validateCustomValues(
      CustomFieldEntity.DEAL,
      data.customFields,
    );

    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          organizationId,
          ownerId: context.userId,
          pipelineId: data.pipelineId,
          stageId: data.stageId,
          companyId: data.companyId,
          contactId: data.contactId,
          name: data.name,
          amount: data.amount,
          currency: data.currency,
          closeDate: data.closeDate ? new Date(data.closeDate) : undefined,
          customFields,
        },
        include: includeDeal,
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.DEAL,
          subjectId: deal.id,
          type: ActivityType.DEAL_CREATED,
        },
      });
      return deal;
    });
  }

  async update(id: string, data: UpdateDealDto) {
    const existing = await this.find(id);
    if (data.companyId) await this.assertCompany(data.companyId);
    if (data.contactId) await this.assertContact(data.contactId);

    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const customFields =
      data.customFields === undefined
        ? undefined
        : await this.configuration.validateCustomValues(
            CustomFieldEntity.DEAL,
            data.customFields,
          );

    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          amount: data.amount,
          currency: data.currency,
          status: data.status,
          companyId: data.companyId,
          contactId: data.contactId,
          closeDate:
            data.closeDate === null
              ? null
              : data.closeDate
                ? new Date(data.closeDate)
                : undefined,
          ...(customFields === undefined ? {} : { customFields }),
        },
        include: includeDeal,
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.DEAL,
          subjectId: deal.id,
          type: ActivityType.DEAL_UPDATED,
          metadata: { fields: Object.keys(data) },
        },
      });
      return deal;
    });
  }

  async moveStage(id: string, data: MoveDealStageDto) {
    const existing = await this.find(id);
    const stage = await this.assertStage(existing.pipelineId, data.stageId);
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();

    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.update({
        where: { id: existing.id },
        data: { stageId: stage.id },
        include: includeDeal,
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.DEAL,
          subjectId: deal.id,
          type: ActivityType.DEAL_STAGE_CHANGED,
          metadata: {
            fromStageId: existing.stageId,
            toStageId: stage.id,
          },
        },
      });
      return deal;
    });
  }

  async archive(id: string) {
    const existing = await this.find(id);
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.update({
        where: { id: existing.id },
        data: { archivedAt: new Date() },
        include: includeDeal,
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.DEAL,
          subjectId: deal.id,
          type: ActivityType.DEAL_ARCHIVED,
        },
      });
      return deal;
    });
  }
}
