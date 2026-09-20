import { OrganizationStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length, Matches, ValidateIf } from 'class-validator';
export class CreateOrganizationDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 160)
  name!: string;
  @IsString()
  @Length(1, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;
}
