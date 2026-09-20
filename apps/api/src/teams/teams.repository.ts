import { Injectable } from '@nestjs/common';
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
}
