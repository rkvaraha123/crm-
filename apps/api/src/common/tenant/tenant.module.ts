import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { OrganizationContextService } from './organization-context.service';
import { OrganizationContextInterceptor } from './organization-context.interceptor';
import { TenantAccessGuard } from './tenant-access.guard';
@Global()
@Module({
  imports: [AuthModule, DatabaseModule],
  providers: [
    OrganizationContextService,
    OrganizationContextInterceptor,
    TenantAccessGuard,
  ],
  exports: [
    AuthModule,
    OrganizationContextService,
    OrganizationContextInterceptor,
    TenantAccessGuard,
  ],
})
export class TenantModule {}
