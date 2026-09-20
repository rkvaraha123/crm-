import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/database/prisma.service';
import type { AuthenticatedPrincipal } from './authenticated-principal';
@Injectable()
export class IdentityLinkingService {
  constructor(private readonly prisma: PrismaService) {}
  async resolve(principal: AuthenticatedPrincipal) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const linked = await tx.user.findUnique({
              where: { identityProviderId: principal.subject },
            });
            if (linked) {
              if (linked.status === 'ACTIVE') return linked;
              if (
                linked.status !== 'INVITED' ||
                !principal.emailVerified ||
                linked.email !== principal.email
              )
                throw new ForbiddenException('CRM access not permitted');
              return tx.user.update({
                where: { id: linked.id },
                data: { status: 'ACTIVE' },
              });
            }
            if (!principal.emailVerified || !principal.email)
              throw new ForbiddenException('CRM access not permitted');
            const invited = await tx.user.findUnique({
              where: { email: principal.email },
            });
            if (
              !invited ||
              invited.identityProviderId !== null ||
              !['ACTIVE', 'INVITED'].includes(invited.status)
            )
              throw new ForbiddenException('CRM access not permitted');
            const changed = await tx.user.updateMany({
              where: {
                id: invited.id,
                identityProviderId: null,
                status: { in: ['ACTIVE', 'INVITED'] },
              },
              data: { identityProviderId: principal.subject, status: 'ACTIVE' },
            });
            if (changed.count !== 1)
              throw new ForbiddenException('CRM access not permitted');
            return tx.user.findUniqueOrThrow({ where: { id: invited.id } });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        )
          continue;
        if (error instanceof ForbiddenException) throw error;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2002', 'P2034'].includes(error.code)
        )
          throw new ForbiddenException('CRM access not permitted');
        throw error;
      }
    }
    throw new ForbiddenException('CRM access not permitted');
  }
}
