import { UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
export class CreateUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 80)
  firstName!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 80)
  lastName!: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(UserStatus)
  status?: UserStatus;
  // identityProviderId is intentionally not client writable. Future verified identity linking owns it.
}
