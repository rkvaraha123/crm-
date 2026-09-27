import { SetMetadata } from '@nestjs/common';
import { CrmModuleKey } from '@prisma/client';

export const REQUIRED_CRM_MODULE = 'required-crm-module';

export const RequireCrmModule = (key: CrmModuleKey) =>
  SetMetadata(REQUIRED_CRM_MODULE, key);
