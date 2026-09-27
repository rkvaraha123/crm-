import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { OrganizationContextService } from './tenant/organization-context.service';

export type ProductFeature =
  | 'companiesEnabled'
  | 'contactsEnabled'
  | 'leadsEnabled'
  | 'dealsEnabled'
  | 'tasksEnabled'
  | 'activitiesEnabled';

@Injectable()
export class ProductFeatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
  ) {}

  async require(feature: ProductFeature) {
    const organizationId = this.context.requireOrganization();
    const config = await this.prisma.organizationProductConfig.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {},
      select: { [feature]: true },
    });
    if (!config[feature])
      throw new ForbiddenException('CRM module is disabled for this organization');
  }
}
