import { DealStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PageDto } from '../../common/dto/page.dto';

export class ListDealsDto extends PageDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(DealStatus)
  status?: DealStatus;

  @IsOptional()
  @IsUUID()
  pipelineId?: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;
}
