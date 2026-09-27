import { Injectable, Logger } from '@nestjs/common';

export type AuthorizationAuditAction =
  | 'ROLE_ASSIGNED'
  | 'ROLE_REMOVED'
  | 'ROLE_CREATED'
  | 'ROLE_UPDATED'
  | 'ROLE_DELETED'
  | 'ROLE_PERMISSIONS_CHANGED'
  | 'ROLE_RECORD_SCOPES_CHANGED';

@Injectable()
export class AuthorizationAuditService {
  private readonly logger = new Logger('AuthorizationAudit');

  record(event: {
    action: AuthorizationAuditAction;
    actorUserId: string;
    organizationId: string;
    targetId: string;
  }) {
    this.logger.log(JSON.stringify(event));
  }
}
