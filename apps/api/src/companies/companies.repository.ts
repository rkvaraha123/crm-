import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

const ownerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

@Injectable()
export class CompaniesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
  ) {}

  list(query: ListCompaniesDto) {
    const organizationId = this.context.requireOrganization();
    const search = query.search;
    return this.prisma.company.findMany({
      where: {
        organizationId,
        archivedAt: null,
        ...(query.lifecycleStatus
          ? { lifecycleStatus: query.lifecycleStatus }
          : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { domain: { contains: search, mode: 'insensitive' as const } },
                {
                  industry: { contains: search, mode: 'insensitive' as const },
                },
              ],
            }
          : {}),
      },
      take: query.limit,
      skip: query.offset,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: { owner: { select: ownerSelect } },
    });
  }

  find(id: string) {
    return this.prisma.company.findFirstOrThrow({
      where: {
        id,
        organizationId: this.context.requireOrganization(),
        archivedAt: null,
      },
      include: { owner: { select: ownerSelect } },
    });
  }

  create(data: CreateCompanyDto) {
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    return this.prisma.company.create({
      data: {
        ...data,
        organizationId,
        ownerId: context.userId,
      },
      include: { owner: { select: ownerSelect } },
    });
  }

  async update(id: string, data: UpdateCompanyDto) {
    const existing = await this.find(id);
    return this.prisma.company.update({
      where: { id: existing.id },
      data,
      include: { owner: { select: ownerSelect } },
    });
  }

  async archive(id: string) {
    const existing = await this.find(id);
    return this.prisma.company.update({
      where: { id: existing.id },
      data: { archivedAt: new Date() },
      include: { owner: { select: ownerSelect } },
    });
  }
}
