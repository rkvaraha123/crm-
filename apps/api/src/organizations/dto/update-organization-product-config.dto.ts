import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

function trim(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateOrganizationProductConfigDto {
  @IsOptional()
  @IsBoolean()
  companiesEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  contactsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  leadsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  dealsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  tasksEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  activitiesEnabled?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @Length(1, 40)
  dashboardLabel?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @Length(1, 40)
  companiesLabel?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @Length(1, 40)
  contactsLabel?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @Length(1, 40)
  leadsLabel?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @Length(1, 40)
  dealsLabel?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @Length(1, 40)
  tasksLabel?: string;
}
