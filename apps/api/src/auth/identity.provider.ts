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
    // Global provisioning stays disabled pending Task 4; token realm/client roles
    // never confer CRM system privileges. Bootstrap is an operator-only CLI.
    return {
      userId: user.id,
      identityProviderId: principal.subject,
      systemAdmin: false,
    };
  }
}
