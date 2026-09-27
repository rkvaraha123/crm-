import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CrmModuleKey } from '@prisma/client';
import { CrmConfigurationService } from './crm-configuration.service';
import { REQUIRED_CRM_MODULE } from './require-crm-module.decorator';

@Injectable()
export class CrmModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configuration: CrmConfigurationService,
  ) {}

  async canActivate(execution: ExecutionContext) {
    const key = this.reflector.getAllAndOverride<CrmModuleKey>(
      REQUIRED_CRM_MODULE,
      [execution.getHandler(), execution.getClass()],
    );
    if (!key) return true;
    if (!(await this.configuration.isEnabled(key)))
      throw new ForbiddenException('CRM module is disabled');
    return true;
  }
}
