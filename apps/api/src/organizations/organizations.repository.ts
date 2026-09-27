import { Injectable } from '@nestjs/common';
import { MembershipStatus } from '@prisma/client';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { PageDto } from '../common/dto/page.dto';
import { createDefaultRoles } from '../roles/default-roles';
import { seedOrganizationProduct } from '../configuration/crm-modules';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateOrganizationAppearanceDto } from './dto/update-organization-appearance.dto';
@Injectable()
export class OrganizationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
  ) {}
  create(data: CreateOrganizationDto) {
    this.context.requireSystemAdmin();
    return this.prisma.$transaction(
      async (tx) => {
        const organization = await tx.organization.create({ data });
        await createDefaultRoles(tx, organization.id);
        await seedOrganizationProduct(tx, organization.id);
        return organization;
      },
      { timeout: 30000 },
    );
  }
  findCurrent() {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: this.context.requireOrganization() },
    });
  }
  createMember(data: CreateMemberDto) {
    const status = data.status ?? MembershipStatus.INVITED;
    return this.prisma.organizationMember.create({
      data: {
        organizationId: this.context.requireOrganization(),
        userId: data.userId,
        status,
        joinedAt: status === 'ACTIVE' ? new Date() : null,
      },
    });
  }
  getAppearance() {
    const organizationId = this.context.requireOrganization();
    return this.prisma.organizationAppearance
      .findUnique({ where: { organizationId } })
      .then(
        (appearance) =>
          appearance ?? {
            organizationId,
            workspaceName: 'RK Varaha CRM',
            primaryColor: '#0f766e',
            accentColor: '#14b8a6',
            sidebarColor: '#0f172a',
            pageBackground: '#f5f7fb',
            surfaceColor: '#ffffff',
          },
      );
  }

  updateAppearance(data: UpdateOrganizationAppearanceDto) {
    const organizationId = this.context.requireOrganization();
    return this.prisma.organizationAppearance.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
  }

  async resetAppearance() {
    const organizationId = this.context.requireOrganization();
    await this.prisma.organizationAppearance.deleteMany({
      where: { organizationId },
    });
    return this.getAppearance();
  }

  listMembers(page: PageDto) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId: this.context.requireOrganization() },
      take: page.limit,
      skip: page.offset,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
    });
  }
}
