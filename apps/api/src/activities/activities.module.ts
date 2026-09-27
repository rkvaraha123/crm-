import { Module } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CompanyActivitiesController } from './company-activities.controller';
import { ContactActivitiesController } from './contact-activities.controller';

@Module({
  controllers: [CompanyActivitiesController, ContactActivitiesController],
  providers: [ActivitiesService],
})
export class ActivitiesModule {}
