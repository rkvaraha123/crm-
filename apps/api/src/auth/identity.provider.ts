import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { JwtVerifierService } from './jwt-verifier.service';
import { IdentityLinkingService } from './identity-linking.service';
export interface VerifiedIdentity {
  userId: string;
  identityProviderId?: string;
  systemAdmin: boolean;
}
@Injectable()
export class IdentityProvider {
  constructor(
    private readonly verifier: JwtVerifierService,
    private readonly linking: IdentityLinkingService,
  ) {}
  async resolve(request: Request): Promise<VerifiedIdentity> {
    const principal = await this.verifier.verify(request.headers.authorization);
    const user = await this.linking.resolve(principal);
    // Token realm/client roles never confer CRM privileges. Platform authority
    // is resolved separately from PostgreSQL role assignments.
    return {
      userId: user.id,
      identityProviderId: principal.subject,
      systemAdmin: false,
    };
  }
}
