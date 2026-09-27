import { LeadStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

const clean = (value: unknown) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class UpdateLeadDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => clean(value))
  @IsString()
  @Length(1, 80)
  firstName?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => clean(value))
  @IsString()
  @Length(1, 80)
  lastName?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || undefined : value,
  )
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => clean(value))
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => clean(value))
  @IsString()
  @MaxLength(180)
  companyName?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => clean(value))
  @IsString()
  @MaxLength(120)
  source?: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => clean(value))
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
