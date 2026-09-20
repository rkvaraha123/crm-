import { TeamStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
export class CreateTeamDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string | null;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(TeamStatus)
  status?: TeamStatus;
}
