import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { VerifiedIdentity } from './identity.provider';
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async me(@CurrentUser() identity: VerifiedIdentity) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: identity.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        memberships: {
          where: { status: 'ACTIVE', organization: { status: 'ACTIVE' } },
          orderBy: { organization: { name: 'asc' } },
          select: {
            status: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    const { memberships, ...profile } = user;
    return {
      ...profile,
      organizations: memberships.map((membership) => ({
        ...membership.organization,
        membershipStatus: membership.status,
      })),
    };
  }
}
