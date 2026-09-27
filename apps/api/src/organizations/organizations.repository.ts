import { Injectable } from '@nestjs/common';
import { MembershipStatus } from '@prisma/client';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { PageDto } from '../common/dto/page.dto';
import { createDefaultRoles } from '../roles/default-roles';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateOrganizationAppearanceDto } from './dto/update-organization-appearance.dto';
import { UpdateOrganizationProductConfigDto } from './dto/update-organization-product-config.dto';
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
        await tx.organizationProductConfig.create({
          data: { organizationId: organization.id },
        });
        const pipeline = await tx.pipeline.create({
          data: {
            organizationId: organization.id,
            name: 'Sales Pipeline',
            isDefault: true,
          },
        });
        await tx.pipelineStage.createMany({
          data: [
            {
              pipelineId: pipeline.id,
              name: 'New',
              position: 1,
              probability: 10,
            },
            {
              pipelineId: pipeline.id,
              name: 'Qualified',
              position: 2,
              probability: 30,
            },
            {
              pipelineId: pipeline.id,
              name: 'Proposal',
              position: 3,
              probability: 60,
            },
            {
              pipelineId: pipeline.id,
              name: 'Negotiation',
              position: 4,
              probability: 80,
            },
            {
              pipelineId: pipeline.id,
              name: 'Closed Won',
              position: 5,
              probability: 100,
            },
            {
              pipelineId: pipeline.id,
              name: 'Closed Lost',
              position: 6,
              probability: 0,
            },
          ],
        });
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

  getProductConfig() {
    const organizationId = this.context.requireOrganization();
    return this.prisma.organizationProductConfig.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {},
    });
  }

  updateProductConfig(data: UpdateOrganizationProductConfigDto) {
    const organizationId = this.context.requireOrganization();
    return this.prisma.organizationProductConfig.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
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
