import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { PageDto } from '../common/dto/page.dto';
@Injectable()
export class RolesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
  ) {}
  list(page: PageDto) {
    return this.prisma.role.findMany({
      where: { organizationId: this.context.requireOrganization() },
      take: page.limit,
      skip: page.offset,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: {
        permissions: {
          orderBy: { permission: { key: 'asc' } },
          select: { permission: { select: { id: true, key: true } } },
        },
        recordScopes: {
          orderBy: { resource: 'asc' },
          select: { resource: true, scope: true },
        },
      },
    });
  }
}
