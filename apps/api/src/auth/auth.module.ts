import { Module } from '@nestjs/common';
import { DatabaseModule } from '../common/database/database.module';
import { IdentityProvider } from './identity.provider';
import { JwtVerifierService } from './jwt-verifier.service';
import { IdentityLinkingService } from './identity-linking.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MeController } from './me.controller';
import { KeycloakAdminService } from './keycloak-admin.service';
@Module({
  imports: [DatabaseModule],
  controllers: [MeController],
  providers: [
    IdentityProvider,
    JwtVerifierService,
    IdentityLinkingService,
    JwtAuthGuard,
    KeycloakAdminService,
  ],
  exports: [IdentityProvider, JwtAuthGuard, KeycloakAdminService],
})
export class AuthModule {}
