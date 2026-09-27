import { ContactLifecycleStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageDto } from '../../common/dto/page.dto';

export class ListContactsDto extends PageDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(ContactLifecycleStatus)
  lifecycleStatus?: ContactLifecycleStatus;
}
