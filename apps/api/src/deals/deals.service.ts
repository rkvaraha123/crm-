import { BadRequestException, Injectable } from '@nestjs/common';
import { ActivitySubjectType, ActivityType } from '@prisma/client';
import { RecordScopeService } from '../authorization/record-scope.service';
import { PrismaService } from '../common/database/prisma.service';
import { ProductFeatureService } from '../common/product-feature.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';

const ownerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
    private readonly scopes: RecordScopeService,
    private readonly features: ProductFeatureService,
  ) {}

  async listPipelines() {
    await this.features.require('dealsEnabled');
    return this.prisma.pipeline.findMany({
      where: {
        organizationId: this.context.requireOrganization(),
        isActive: true,
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        stages: {
          where: { isActive: true },
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  async list(search?: string) {
    await this.features.require('dealsEnabled');
    const organizationId = this.context.requireOrganization();
    const access = await this.scopes.dealWhere();
    return this.prisma.deal.findMany({
      where: {
        organizationId,
        ...access,
        archivedAt: null,
        ...(search
          ? { name: { contains: search, mode: 'insensitive' as const } }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 100,
      include: {
        owner: { select: ownerSelect },
        pipeline: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true, position: true } },
        company: { select: { id: true, name: true } },
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  private async validateAssociations(
    pipelineId: string,
    stageId: string,
    companyId?: string,
    contactId?: string,
  ) {
    const organizationId = this.context.requireOrganization();
    const [pipeline, stage, company, contact] = await Promise.all([
      this.prisma.pipeline.findFirst({
        where: { id: pipelineId, organizationId, isActive: true },
        select: { id: true },
      }),
      this.prisma.pipelineStage.findFirst({
        where: {
          id: stageId,
          pipelineId,
          pipeline: { organizationId },
          isActive: true,
        },
        select: { id: true },
      }),
      companyId
        ? this.prisma.company.findFirst({
            where: { id: companyId, organizationId, archivedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
      contactId
        ? this.prisma.contact.findFirst({
            where: { id: contactId, organizationId, archivedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!pipeline || !stage)
      throw new BadRequestException('Invalid pipeline or stage');
    if (companyId && !company) throw new BadRequestException('Invalid company');
    if (contactId && !contact) throw new BadRequestException('Invalid contact');
  }

  async find(id: string) {
    await this.features.require('dealsEnabled');
    const access = await this.scopes.dealWhere();
    return this.prisma.deal.findFirstOrThrow({
      where: {
        id,
        organizationId: this.context.requireOrganization(),
        ...access,
        archivedAt: null,
      },
    });
  }

  async create(data: CreateDealDto) {
    await this.features.require('dealsEnabled');
    await this.validateAssociations(
      data.pipelineId,
      data.stageId,
      data.companyId,
      data.contactId,
    );
    const current = this.context.current();
    const organizationId = this.context.requireOrganization();
    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          organizationId,
          ownerId: current.userId,
          pipelineId: data.pipelineId,
          stageId: data.stageId,
          name: data.name,
          amount: data.amount,
          currency: data.currency,
          status: data.status,
          closeDate: data.closeDate ? new Date(data.closeDate) : undefined,
          companyId: data.companyId,
          contactId: data.contactId,
        },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: current.userId,
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
    const stageId = data.stageId ?? existing.stageId;
    await this.validateAssociations(
      existing.pipelineId,
      stageId,
      data.companyId ?? existing.companyId ?? undefined,
      data.contactId ?? existing.contactId ?? undefined,
    );
    const current = this.context.current();
    const organizationId = this.context.requireOrganization();
    const stageChanged = !!data.stageId && data.stageId !== existing.stageId;
    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.update({
        where: { id: existing.id },
        data: {
          ...data,
          closeDate: data.closeDate ? new Date(data.closeDate) : undefined,
        },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: current.userId,
          subjectType: ActivitySubjectType.DEAL,
          subjectId: deal.id,
          type: stageChanged
            ? ActivityType.DEAL_STAGE_CHANGED
            : ActivityType.DEAL_UPDATED,
          metadata: { fields: Object.keys(data) },
        },
      });
      return deal;
    });
  }

  async archive(id: string) {
    const existing = await this.find(id);
    const current = this.context.current();
    const organizationId = this.context.requireOrganization();
    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.update({
        where: { id: existing.id },
        data: { archivedAt: new Date() },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: current.userId,
          subjectType: ActivitySubjectType.DEAL,
          subjectId: deal.id,
          type: ActivityType.DEAL_ARCHIVED,
        },
      });
      return deal;
    });
  }
}
