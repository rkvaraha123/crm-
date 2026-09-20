import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationsRepository } from './organizations.repository';
@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsRepository],
})
export class OrganizationsModule {}
