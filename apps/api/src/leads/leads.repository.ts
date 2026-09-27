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
import { AssignLeadDto } from './dto/assign-lead.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

const ownerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

@Injectable()
export class LeadsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
    private readonly recordScope: RecordScopeService,
    private readonly configuration: CrmConfigurationService,
  ) {}

  async list(query: ListLeadsDto) {
    const organizationId = this.context.requireOrganization();
    const access = await this.recordScope.leadWhere();
    const search = query.search;
    return this.prisma.lead.findMany({
      where: {
        organizationId,
        ...access,
        archivedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(search
          ? {
              OR: [
                {
                  firstName: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  lastName: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  companyName: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      take: query.limit,
      skip: query.offset,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: { owner: { select: ownerSelect } },
    });
  }

  async find(id: string) {
    const access = await this.recordScope.leadWhere();
    return this.prisma.lead.findFirstOrThrow({
      where: {
        id,
        organizationId: this.context.requireOrganization(),
        ...access,
        archivedAt: null,
      },
      include: { owner: { select: ownerSelect } },
    });
  }

  private assertMeaningful(data: {
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
  }) {
    if (
      !data.firstName &&
      !data.lastName &&
      !data.companyName &&
      !data.email &&
      !data.phone
    )
      throw new BadRequestException(
        'Lead requires a name, company, email, or phone',
      );
  }

  async create(data: CreateLeadDto) {
    this.assertMeaningful(data);
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const customFields = await this.configuration.validateCustomValues(
      CustomFieldEntity.LEAD,
      data.customFields,
    );
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          companyName: data.companyName,
          email: data.email,
          phone: data.phone,
          source: data.source,
          status: data.status,
          customFields,
          organizationId,
          ownerId: context.userId,
        },
        include: { owner: { select: ownerSelect } },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.LEAD,
          subjectId: lead.id,
          type: ActivityType.LEAD_CREATED,
        },
      });
      return lead;
    });
  }

  async update(id: string, data: UpdateLeadDto) {
    const existing = await this.find(id);
    this.assertMeaningful({ ...existing, ...data });
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const customFields =
      data.customFields === undefined
        ? undefined
        : await this.configuration.validateCustomValues(
            CustomFieldEntity.LEAD,
            data.customFields,
          );

    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id: existing.id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          companyName: data.companyName,
          email: data.email,
          phone: data.phone,
          source: data.source,
          status: data.status,
          ...(customFields === undefined ? {} : { customFields }),
        },
        include: { owner: { select: ownerSelect } },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.LEAD,
          subjectId: lead.id,
          type: ActivityType.LEAD_UPDATED,
          metadata: { fields: Object.keys(data) },
        },
      });
      return lead;
    });
  }

  async assign(id: string, data: AssignLeadDto) {
    const existing = await this.find(id);
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: data.ownerId,
        },
      },
      select: { status: true },
    });
    if (membership?.status !== 'ACTIVE')
      throw new BadRequestException('Lead owner must be an active member');

    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id: existing.id },
        data: { ownerId: data.ownerId },
        include: { owner: { select: ownerSelect } },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.LEAD,
          subjectId: lead.id,
          type: ActivityType.LEAD_UPDATED,
          metadata: { fields: ['ownerId'] },
        },
      });
      return lead;
    });
  }

  async archive(id: string) {
    const existing = await this.find(id);
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id: existing.id },
        data: { archivedAt: new Date() },
        include: { owner: { select: ownerSelect } },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.LEAD,
          subjectId: lead.id,
          type: ActivityType.LEAD_ARCHIVED,
        },
      });
      return lead;
    });
  }
}
