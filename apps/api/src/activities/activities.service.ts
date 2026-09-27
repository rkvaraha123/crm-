import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivitySubjectType, ActivityType } from '@prisma/client';
import { RecordScopeService } from '../authorization/record-scope.service';
import { PrismaService } from '../common/database/prisma.service';
import { PageDto } from '../common/dto/page.dto';
import { OrganizationContextService } from '../common/tenant/organization-context.service';

const actorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
    private readonly recordScope: RecordScopeService,
  ) {}

  private async assertSubjectAccess(
    subjectType: ActivitySubjectType,
    subjectId: string,
  ) {
    const organizationId = this.context.requireOrganization();

    if (subjectType === ActivitySubjectType.COMPANY) {
      const access = await this.recordScope.companyWhere();
      const company = await this.prisma.company.findFirst({
        where: {
          id: subjectId,
          organizationId,
          ...access,
          archivedAt: null,
        },
        select: { id: true },
      });
      if (!company) throw new NotFoundException('Company not found');
      return;
    }

    const access = await this.recordScope.contactWhere();
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: subjectId,
        organizationId,
        ...access,
        archivedAt: null,
      },
      select: { id: true },
    });
    if (!contact) throw new NotFoundException('Contact not found');
  }

  async list(
    subjectType: ActivitySubjectType,
    subjectId: string,
    page: PageDto,
  ) {
    await this.assertSubjectAccess(subjectType, subjectId);
    return this.prisma.activity.findMany({
      where: {
        organizationId: this.context.requireOrganization(),
        subjectType,
        subjectId,
        archivedAt: null,
      },
      take: page.limit,
      skip: page.offset,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { actor: { select: actorSelect } },
    });
  }

  async createNote(
    subjectType: ActivitySubjectType,
    subjectId: string,
    body: string,
  ) {
    await this.assertSubjectAccess(subjectType, subjectId);
    const context = this.context.current();
    return this.prisma.activity.create({
      data: {
        organizationId: this.context.requireOrganization(),
        actorUserId: context.userId,
        subjectType,
        subjectId,
        type: ActivityType.NOTE,
        body,
      },
      include: { actor: { select: actorSelect } },
    });
  }

  async updateNote(
    subjectType: ActivitySubjectType,
    subjectId: string,
    activityId: string,
    body: string,
  ) {
    await this.assertSubjectAccess(subjectType, subjectId);
    const organizationId = this.context.requireOrganization();
    const note = await this.prisma.activity.findFirst({
      where: {
        id: activityId,
        organizationId,
        subjectType,
        subjectId,
        type: ActivityType.NOTE,
        archivedAt: null,
      },
      select: { id: true },
    });
    if (!note) throw new NotFoundException('Note not found');
    return this.prisma.activity.update({
      where: { id: note.id },
      data: { body },
      include: { actor: { select: actorSelect } },
    });
  }

  async archiveNote(
    subjectType: ActivitySubjectType,
    subjectId: string,
    activityId: string,
  ) {
    await this.assertSubjectAccess(subjectType, subjectId);
    const organizationId = this.context.requireOrganization();
    const note = await this.prisma.activity.findFirst({
      where: {
        id: activityId,
        organizationId,
        subjectType,
        subjectId,
        type: ActivityType.NOTE,
        archivedAt: null,
      },
      select: { id: true },
    });
    if (!note) throw new NotFoundException('Note not found');
    return this.prisma.activity.update({
      where: { id: note.id },
      data: { archivedAt: new Date() },
      include: { actor: { select: actorSelect } },
    });
  }
}
