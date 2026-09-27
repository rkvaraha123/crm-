import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class CreateDealDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 180)
  name!: string;

  @IsUUID()
  pipelineId!: string;

  @IsUUID()
  stageId!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : String(value),
  )
  @Matches(/^\d{1,16}(?:\.\d{1,2})?$/)
  amount?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  closeDate?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
