import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { isEmail } from 'class-validator';
import type { AuthenticatedPrincipal } from './authenticated-principal';
@Injectable()
export class JwtVerifierService {
  private readonly keys;
  constructor(private readonly config: ConfigService) {
    this.keys = createRemoteJWKSet(
      new URL(config.getOrThrow<string>('KEYCLOAK_JWKS_URL')),
      { timeoutDuration: 5000, cooldownDuration: 5000, cacheMaxAge: 600000 },
    );
  }
  async verify(authorization?: string): Promise<AuthenticatedPrincipal> {
    const match = authorization?.match(
      /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i,
    );
    if (!match || match[1].length > 16384)
      throw new UnauthorizedException('Invalid authentication');
    try {
      const { payload } = await jwtVerify(match[1], this.keys, {
        issuer: this.config.getOrThrow<string>('KEYCLOAK_ISSUER'),
        audience: this.config.getOrThrow<string>('KEYCLOAK_API_AUDIENCE'),
        algorithms: ['RS256'],
        requiredClaims: ['sub', 'exp', 'iat'],
        clockTolerance: 5,
      });
      if (
        typeof payload.sub !== 'string' ||
        !payload.sub.trim() ||
        payload.sub.length > 255 ||
        payload.typ !== 'Bearer'
      )
        throw new Error('Invalid access token');
      if (
        payload.email !== undefined &&
        (typeof payload.email !== 'string' ||
          payload.email.length > 254 ||
          !isEmail(payload.email))
      )
        throw new Error('Invalid email claim');
      return {
        subject: payload.sub,
        email:
          typeof payload.email === 'string'
            ? payload.email.trim().toLowerCase()
            : undefined,
        emailVerified: payload.email_verified === true,
      };
    } catch {
      throw new UnauthorizedException('Invalid authentication');
    }
  }
}
