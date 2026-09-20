import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { IdentityProvider, VerifiedIdentity } from './identity.provider';
export const CURRENT_USER = Symbol('current-user');
export type AuthenticatedRequest = Request & {
  [CURRENT_USER]?: VerifiedIdentity;
};
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly identities: IdentityProvider) {}
  async canActivate(execution: ExecutionContext) {
    const request = execution.switchToHttp().getRequest<AuthenticatedRequest>();
    request[CURRENT_USER] = await this.identities.resolve(request);
    return true;
  }
}
