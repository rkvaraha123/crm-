import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  Prisma,
  RecordResource,
  RecordScope,
} from '@prisma/client';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';

type DatabaseClient = PrismaService | Prisma.TransactionClient;

const SCOPE_RANK: Record<RecordScope, number> = {
  [RecordScope.OWN]: 1,
  [RecordScope.TEAM]: 2,
  [RecordScope.ORGANIZATION]: 3,
};

@Injectable()
export class RecordScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
  ) {}

  rank(scope: RecordScope) {
    return SCOPE_RANK[scope];
  }

  async getEffectiveRecordScope(
    userId: string,
    organizationId: string,
    resource: RecordResource,
    database: DatabaseClient = this.prisma,
  ): Promise<RecordScope | null> {
    const assignments = await database.userRole.findMany({
      where: {
        userId,
        organizationId,
        membership: {
          status: 'ACTIVE',
          organization: { status: 'ACTIVE' },
          user: { status: 'ACTIVE' },
        },
        role: {
          OR: [{ organizationId }, { organizationId: null }],
        },
      },
      select: {
        role: {
          select: {
            recordScopes: {
              where: { resource },
              select: { scope: true },
            },
          },
        },
      },
    });

    const scopes = assignments.flatMap(({ role }) =>
      role.recordScopes.map(({ scope }) => scope),
    );
    if (scopes.length === 0) return null;
    return scopes.reduce((highest, scope) =>
      SCOPE_RANK[scope] > SCOPE_RANK[highest] ? scope : highest,
    );
  }

  async effectiveScopes() {
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const [companies, contacts] = await Promise.all([
      this.getEffectiveRecordScope(
        context.userId,
        organizationId,
        RecordResource.COMPANIES,
      ),
      this.getEffectiveRecordScope(
        context.userId,
        organizationId,
        RecordResource.CONTACTS,
      ),
    ]);
    return { companies, contacts };
  }

  private async requireScope(resource: RecordResource) {
    const context = this.context.current();
    const organizationId = this.context.requireOrganization();
    const scope = await this.getEffectiveRecordScope(
      context.userId,
      organizationId,
      resource,
    );
    if (!scope) throw new ForbiddenException('Record scope denied');
    return { scope, userId: context.userId, organizationId };
  }

  private teamOwnerFilter(userId: string, organizationId: string) {
    return {
      OR: [
        { ownerId: userId },
        {
          owner: {
            teamMemberships: {
              some: {
                organizationId,
                team: {
                  status: 'ACTIVE' as const,
                  members: {
                    some: { organizationId, userId },
                  },
                },
              },
            },
          },
        },
      ],
    };
  }

  async companyWhere(): Promise<Prisma.CompanyWhereInput> {
    const { scope, userId, organizationId } = await this.requireScope(
      RecordResource.COMPANIES,
    );
    if (scope === RecordScope.ORGANIZATION) return {};
    if (scope === RecordScope.OWN) return { ownerId: userId };
    return this.teamOwnerFilter(userId, organizationId);
  }

  async contactWhere(): Promise<Prisma.ContactWhereInput> {
    const { scope, userId, organizationId } = await this.requireScope(
      RecordResource.CONTACTS,
    );
    if (scope === RecordScope.ORGANIZATION) return {};
    if (scope === RecordScope.OWN) return { ownerId: userId };
    return this.teamOwnerFilter(userId, organizationId);
  }

  async canGrant(
    actorUserId: string,
    organizationId: string,
    resource: RecordResource,
    requested: RecordScope,
    database: DatabaseClient = this.prisma,
  ) {
    const actorScope = await this.getEffectiveRecordScope(
      actorUserId,
      organizationId,
      resource,
      database,
    );
    return !!actorScope && SCOPE_RANK[requested] <= SCOPE_RANK[actorScope];
  }
}
