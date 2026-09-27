import { Injectable } from '@nestjs/common';
import { ActivitySubjectType, ActivityType } from '@prisma/client';
import { RecordScopeService } from '../authorization/record-scope.service';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
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
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
    private readonly scopes: RecordScopeService,
  ) {}

  async list(query: ListLeadsDto) {
    const organizationId = this.context.requireOrganization();
    const access = await this.scopes.leadWhere();
    return this.prisma.lead.findMany({
      where: {
        organizationId,
        ...access,
        archivedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
                {
                  companyName: { contains: query.search, mode: 'insensitive' },
                },
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
    const access = await this.scopes.leadWhere();
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

  async create(data: CreateLeadDto) {
    const current = this.context.current();
    const organizationId = this.context.requireOrganization();
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          ...data,
          organizationId,
          ownerId: current.userId,
        },
        include: { owner: { select: ownerSelect } },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: current.userId,
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
    const current = this.context.current();
    const organizationId = this.context.requireOrganization();
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id: existing.id },
        data,
        include: { owner: { select: ownerSelect } },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: current.userId,
          subjectType: ActivitySubjectType.LEAD,
          subjectId: lead.id,
          type: ActivityType.LEAD_UPDATED,
          metadata: { fields: Object.keys(data) },
        },
      });
      return lead;
    });
  }

  async archive(id: string) {
    const existing = await this.find(id);
    const current = this.context.current();
    const organizationId = this.context.requireOrganization();
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id: existing.id },
        data: { archivedAt: new Date() },
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorUserId: current.userId,
          subjectType: ActivitySubjectType.LEAD,
          subjectId: lead.id,
          type: ActivityType.LEAD_ARCHIVED,
        },
      });
      return lead;
    });
  }
}
