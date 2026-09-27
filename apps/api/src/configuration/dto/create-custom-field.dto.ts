import { CustomFieldEntity, CustomFieldType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateCustomFieldDto {
  @IsEnum(CustomFieldEntity)
  entity!: CustomFieldEntity;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^[a-z][a-z0-9_]{0,79}$/)
  key!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  label!: string;

  @IsEnum(CustomFieldType)
  fieldType!: CustomFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  displayOrder?: number;
}
