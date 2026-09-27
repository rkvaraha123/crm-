import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../common/database/prisma.service';
import { UpdateOrganizationAppearanceDto } from '../organizations/dto/update-organization-appearance.dto';
import { ListAdminOrganizationsDto } from './dto/list-admin-organizations.dto';
import { ListAdminUsersDto } from './dto/list-admin-users.dto';

const DEFAULT_APPEARANCE = {
  workspaceName: 'RK Varaha CRM',
  primaryColor: '#0f766e',
  accentColor: '#14b8a6',
  sidebarColor: '#0f172a',
  pageBackground: '#f5f7fb',
  surfaceColor: '#ffffff',
} as const;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });
    return { ...user, platformAdmin: true };
  }

  async overview() {
    const [
      organizations,
      activeOrganizations,
      suspendedOrganizations,
      users,
      activeUsers,
      companies,
      contacts,
      memberships,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: 'ACTIVE' } }),
      this.prisma.organization.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.company.count({ where: { archivedAt: null } }),
      this.prisma.contact.count({ where: { archivedAt: null } }),
      this.prisma.organizationMember.count({ where: { status: 'ACTIVE' } }),
    ]);

    await this.prisma.$queryRaw`SELECT 1`;

    return {
      organizations,
      activeOrganizations,
      suspendedOrganizations,
      users,
      activeUsers,
      companies,
      contacts,
      memberships,
      database: 'healthy' as const,
    };
  }

  listOrganizations(query: ListAdminOrganizationsDto) {
    const search = query.search;
    return this.prisma.organization.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { slug: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      take: query.limit,
      skip: query.offset,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: {
        _count: {
          select: {
            members: true,
            companies: true,
            contacts: true,
          },
        },
        appearance: {
          select: {
            workspaceName: true,
            primaryColor: true,
            accentColor: true,
            sidebarColor: true,
            pageBackground: true,
            surfaceColor: true,
          },
        },
      },
    });
  }

  async listUsers(query: ListAdminUsersDto) {
    const search = query.search;
    const users = await this.prisma.user.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' as const } },
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
              ],
            }
          : {}),
      },
      take: query.limit,
      skip: query.offset,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        memberships: {
          select: {
            status: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
    });

    const platformAssignments =
      users.length === 0
        ? []
        : await this.prisma.userRole.findMany({
            where: {
              userId: { in: users.map(({ id }) => id) },
              role: {
                organizationId: null,
                name: 'SUPER_ADMIN',
                isSystem: true,
              },
            },
            select: { userId: true },
          });
    const platformAdmins = new Set(
      platformAssignments.map(({ userId }) => userId),
    );

    return users.map((user) => ({
      ...user,
      platformAdmin: platformAdmins.has(user.id),
    }));
  }

  private async assertOrganizationNotAdminAnchor(organizationId: string) {
    const anchor = await this.prisma.userRole.findFirst({
      where: {
        organizationId,
        membership: { status: 'ACTIVE' },
        role: {
          organizationId: null,
          name: 'SUPER_ADMIN',
          isSystem: true,
        },
      },
      select: { id: true },
    });
    if (anchor)
      throw new ForbiddenException(
        'Organization hosts an active platform administrator and cannot be suspended',
      );
  }

  async updateOrganizationStatus(
    organizationId: string,
    status: OrganizationStatus,
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, status: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    if (
      organization.status === OrganizationStatus.ACTIVE &&
      status !== OrganizationStatus.ACTIVE
    )
      await this.assertOrganizationNotAdminAnchor(organizationId);

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { status },
    });
  }

  private async assertUserNotPlatformAdmin(userId: string) {
    const assignment = await this.prisma.userRole.findFirst({
      where: {
        userId,
        role: {
          organizationId: null,
          name: 'SUPER_ADMIN',
          isSystem: true,
        },
      },
      select: { id: true },
    });
    if (assignment)
      throw new ForbiddenException(
        'Platform administrator status cannot be changed here',
      );
  }

  async updateUserStatus(userId: string, status: UserStatus) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (status !== UserStatus.ACTIVE)
      await this.assertUserNotPlatformAdmin(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });
  }

  async getAppearance(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    const appearance = await this.prisma.organizationAppearance.findUnique({
      where: { organizationId },
    });
    return appearance ?? { organizationId, ...DEFAULT_APPEARANCE };
  }

  async updateAppearance(
    organizationId: string,
    data: UpdateOrganizationAppearanceDto,
  ) {
    const exists = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Organization not found');
    return this.prisma.organizationAppearance.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
  }

  async resetAppearance(organizationId: string) {
    const exists = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Organization not found');
    await this.prisma.organizationAppearance.deleteMany({
      where: { organizationId },
    });
    return { organizationId, ...DEFAULT_APPEARANCE };
  }
}
