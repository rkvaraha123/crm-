import { MembershipStatus } from '@prisma/client';
import { IsEnum, IsUUID, ValidateIf } from 'class-validator';
export class CreateMemberDto {
  @IsUUID() userId!: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
