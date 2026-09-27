import { Global, Module } from '@nestjs/common';
import { AuthorizationAuditService } from './authorization-audit.service';
import { AuthorizationService } from './authorization.service';
import { PermissionGuard } from './permission.guard';
import { RecordScopeService } from './record-scope.service';

@Global()
@Module({
  providers: [
    AuthorizationService,
    AuthorizationAuditService,
    PermissionGuard,
    RecordScopeService,
  ],
  exports: [
    AuthorizationService,
    AuthorizationAuditService,
    PermissionGuard,
    RecordScopeService,
  ],
})
export class AuthorizationModule {}
