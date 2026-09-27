import { Global, Module } from '@nestjs/common';
import { CrmConfigurationController } from './crm-configuration.controller';
import { CrmConfigurationService } from './crm-configuration.service';
import { CrmModuleGuard } from './crm-module.guard';

@Global()
@Module({
  controllers: [CrmConfigurationController],
  providers: [CrmConfigurationService, CrmModuleGuard],
  exports: [CrmConfigurationService, CrmModuleGuard],
})
export class CrmConfigurationModule {}
