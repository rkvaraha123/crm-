import { CustomFieldEntity } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListCustomFieldsDto {
  @IsOptional()
  @IsEnum(CustomFieldEntity)
  entity?: CustomFieldEntity;
}
