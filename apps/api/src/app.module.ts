import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActivitiesModule } from './activities/activities.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './common/database/database.module';
import { validateEnvironment } from './common/environment';
import { TenantModule } from './common/tenant/tenant.module';
import { CompaniesModule } from './companies/companies.module';
import { CrmConfigurationModule } from './configuration/crm-configuration.module';
import { ContactsModule } from './contacts/contacts.module';
import { LeadsModule } from './leads/leads.module';
import { DealsModule } from './deals/deals.module';
import { TasksModule } from './tasks/tasks.module';
import { ReportsModule } from './reports/reports.module';
import { HealthModule } from './health/health.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { TeamsModule } from './teams/teams.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    TenantModule,
    CrmConfigurationModule,
    AdminModule,
    TeamsModule,
    RolesModule,
    PermissionsModule,
    HealthModule,
    AuthModule,
    ActivitiesModule,
    OrganizationsModule,
    UsersModule,
    CompaniesModule,
    ContactsModule,
    LeadsModule,
    DealsModule,
    TasksModule,
    ReportsModule,
    CommonModule,
    AuthorizationModule,
  ],
})
export class AppModule {}
