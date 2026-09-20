import { Injectable } from '@nestjs/common';
import { MembershipStatus } from '@prisma/client';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { PageDto } from '../common/dto/page.dto';
import { createDefaultRoles } from '../roles/default-roles';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateMemberDto } from './dto/create-member.dto';
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
