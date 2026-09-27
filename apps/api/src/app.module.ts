import { DatabaseModule } from './common/database/database.module';
import { TenantModule } from './common/tenant/tenant.module';
import { TeamsModule } from './teams/teams.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './common/environment';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';
import { AuthorizationModule } from './authorization/authorization.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    TenantModule,
    TeamsModule,
    RolesModule,
    PermissionsModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    CommonModule,
    AuthorizationModule,
  ],
})
export class AppModule {}
