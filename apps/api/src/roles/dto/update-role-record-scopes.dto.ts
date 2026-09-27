import { RecordScope } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateRoleRecordScopesDto {
  @IsEnum(RecordScope)
  companies!: RecordScope;

  @IsEnum(RecordScope)
  contacts!: RecordScope;
}
