import { CompanyLifecycleStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 180)
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || null : value,
  )
  @Matches(
    /^(?=.{1,255}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
  )
  domain?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  website?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(120)
  industry?: string | null;

  @IsOptional()
  @IsEnum(CompanyLifecycleStatus)
  lifecycleStatus?: CompanyLifecycleStatus;
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
