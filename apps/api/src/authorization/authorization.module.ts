import { Global, Module } from '@nestjs/common';
import { AuthorizationAuditService } from './authorization-audit.service';
import { AuthorizationService } from './authorization.service';
import { PermissionGuard } from './permission.guard';

@Global()
@Module({
  providers: [AuthorizationService, AuthorizationAuditService, PermissionGuard],
  exports: [AuthorizationService, AuthorizationAuditService, PermissionGuard],
})
export class AuthorizationModule {}
