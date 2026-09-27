import { Injectable } from '@nestjs/common';
import {
  ActivitySubjectType,
  ActivityType,
  CustomFieldEntity,
} from '@prisma/client';
import { RecordScopeService } from '../authorization/record-scope.service';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { CrmConfigurationService } from '../configuration/crm-configuration.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

const ownerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

@Injectable()
export class CompaniesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
    private readonly recordScope: RecordScopeService,
    private readonly configuration: CrmConfigurationService,
  ) {}

  async list(query: ListCompaniesDto) {
    const organizationId = this.context.requireOrganization();
    const access = await this.recordScope.companyWhere();
    const search = query.search;
    return this.prisma.company.findMany({
      where: {
        organizationId,
        ...access,
        archivedAt: null,
        ...(query.lifecycleStatus
          ? { lifecycleStatus: query.lifecycleStatus }
          : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { domain: { contains: search, mode: 'insensitive' as const } },
                {
                  industry: { contains: search, mode: 'insensitive' as const },
                },
              ],
            }
          : {}),
      },
      take: query.limit,
      skip: query.offset,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: { owner: { select: ownerSelect } },
    });
  }

  async find(id: string) {
    const access = await this.recordScope.companyWhere();
    return this.prisma.company.findFirstOrThrow({
      where: {
        id,
        organizationId: this.context.requireOrganization(),
        ...access,
        archivedAt: null,
      },
      include: { owner: { select: ownerSelect } },
    });
  }

  async create(data: CreateCompanyDto) {
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const customFields = await this.configuration.validateCustomValues(
      CustomFieldEntity.COMPANY,
      data.customFields,
    );
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: data.name,
          domain: data.domain,
          phone: data.phone,
          website: data.website,
          industry: data.industry,
          lifecycleStatus: data.lifecycleStatus,
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
          subjectType: ActivitySubjectType.COMPANY,
          subjectId: company.id,
          type: ActivityType.COMPANY_CREATED,
        },
      });
      return company;
    });
  }

  async update(id: string, data: UpdateCompanyDto) {
    const existing = await this.find(id);
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const customFields =
      data.customFields === undefined
        ? undefined
        : await this.configuration.validateCustomValues(
            CustomFieldEntity.COMPANY,
            data.customFields,
          );
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          domain: data.domain,
          phone: data.phone,
          website: data.website,
          industry: data.industry,
          lifecycleStatus: data.lifecycleStatus,
          ...(customFields === undefined ? {} : { customFields }),
        },
        include: { owner: { select: ownerSelect } },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.COMPANY,
          subjectId: company.id,
          type: ActivityType.COMPANY_UPDATED,
          metadata: { fields: Object.keys(data) },
        },
      });
      return company;
    });
  }

  async archive(id: string) {
    const existing = await this.find(id);
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id: existing.id },
        data: { archivedAt: new Date() },
        include: { owner: { select: ownerSelect } },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.COMPANY,
          subjectId: company.id,
          type: ActivityType.COMPANY_ARCHIVED,
        },
      });
      return company;
    });
  }
}
