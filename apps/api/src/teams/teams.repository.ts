import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { PageDto } from '../common/dto/page.dto';
import { CreateTeamDto } from './dto/create-team.dto';

@Injectable()
export class TeamsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
  ) {}

  list(page: PageDto) {
    return this.prisma.team.findMany({
      where: { organizationId: this.context.requireOrganization() },
      take: page.limit,
      skip: page.offset,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  create(data: CreateTeamDto) {
    return this.prisma.team.create({
      data: { ...data, organizationId: this.context.requireOrganization() },
    });
  }

  private async requireTeam(teamId: string) {
    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId: this.context.requireOrganization(),
        status: { not: 'ARCHIVED' },
      },
      select: { id: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async listMembers(teamId: string, page: PageDto) {
    await this.requireTeam(teamId);
    return this.prisma.teamMember.findMany({
      where: {
        organizationId: this.context.requireOrganization(),
        teamId,
      },
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

  async addMember(teamId: string, userId: string) {
    await this.requireTeam(teamId);
    const organizationId = this.context.requireOrganization();
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { status: true },
    });
    if (membership?.status !== 'ACTIVE')
      throw new BadRequestException(
        'User must be an active organization member',
      );
    return this.prisma.teamMember.create({
      data: { organizationId, teamId, userId },
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

  async removeMember(teamId: string, userId: string) {
    await this.requireTeam(teamId);
    const organizationId = this.context.requireOrganization();
    const existing = await this.prisma.teamMember.findFirst({
      where: { organizationId, teamId, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Team member not found');
    await this.prisma.teamMember.delete({ where: { id: existing.id } });
    return { removed: true };
  }
}
