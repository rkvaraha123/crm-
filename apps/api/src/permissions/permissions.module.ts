import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import { PermissionsController } from './permissions.controller';

@Module({ imports: [RolesModule], controllers: [PermissionsController] })
export class PermissionsModule {}
