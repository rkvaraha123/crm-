import { BadRequestException, Injectable } from '@nestjs/common';
import { ActivitySubjectType, ActivityType, CustomFieldEntity } from '@prisma/client';
import { RecordScopeService } from '../authorization/record-scope.service';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { CrmConfigurationService } from '../configuration/crm-configuration.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

const ownerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

const companySelect = {
  id: true,
  name: true,
  domain: true,
  lifecycleStatus: true,
} as const;

@Injectable()
export class ContactsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
    private readonly recordScope: RecordScopeService,
    private readonly configuration: CrmConfigurationService,
  ) {}

  async list(query: ListContactsDto) {
    const organizationId = this.context.requireOrganization();
    const access = await this.recordScope.contactWhere();
    const search = query.search;
    return this.prisma.contact.findMany({
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
                {
                  firstName: { contains: search, mode: 'insensitive' as const },
                },
                {
                  lastName: { contains: search, mode: 'insensitive' as const },
                },
                { email: { contains: search, mode: 'insensitive' as const } },
                {
                  jobTitle: { contains: search, mode: 'insensitive' as const },
                },
              ],
            }
          : {}),
      },
      take: query.limit,
      skip: query.offset,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      include: {
        owner: { select: ownerSelect },
        company: { select: companySelect },
      },
    });
  }

  async find(id: string) {
    const access = await this.recordScope.contactWhere();
    return this.prisma.contact.findFirstOrThrow({
      where: {
        id,
        organizationId: this.context.requireOrganization(),
        ...access,
        archivedAt: null,
      },
      include: {
        owner: { select: ownerSelect },
        company: { select: companySelect },
      },
    });
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

  async create(data: CreateContactDto) {
    if (data.companyId) await this.assertCompany(data.companyId);
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const customFields = await this.configuration.validateCustomValues(
      CustomFieldEntity.CONTACT,
      data.customFields,
    );
    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          jobTitle: data.jobTitle,
          companyId: data.companyId,
          lifecycleStatus: data.lifecycleStatus,
          customFields,
          organizationId,
          ownerId: context.userId,
        },
        include: {
          owner: { select: ownerSelect },
          company: { select: companySelect },
        },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.CONTACT,
          subjectId: contact.id,
          type: ActivityType.CONTACT_CREATED,
        },
      });
      return contact;
    });
  }

  async update(id: string, data: UpdateContactDto) {
    const existing = await this.find(id);
    if (data.companyId) await this.assertCompany(data.companyId);
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const customFields =
      data.customFields === undefined
        ? undefined
        : await this.configuration.validateCustomValues(
            CustomFieldEntity.CONTACT,
            data.customFields,
          );
    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.update({
        where: { id: existing.id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          jobTitle: data.jobTitle,
          companyId: data.companyId,
          lifecycleStatus: data.lifecycleStatus,
          ...(customFields === undefined ? {} : { customFields }),
        },
        include: {
          owner: { select: ownerSelect },
          company: { select: companySelect },
        },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.CONTACT,
          subjectId: contact.id,
          type: ActivityType.CONTACT_UPDATED,
          metadata: { fields: Object.keys(data) },
        },
      });
      return contact;
    });
  }

  async archive(id: string) {
    const existing = await this.find(id);
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.update({
        where: { id: existing.id },
        data: { archivedAt: new Date() },
        include: {
          owner: { select: ownerSelect },
          company: { select: companySelect },
        },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: context.userId,
          subjectType: ActivitySubjectType.CONTACT,
          subjectId: contact.id,
          type: ActivityType.CONTACT_ARCHIVED,
        },
      });
      return contact;
    });
  }
}
