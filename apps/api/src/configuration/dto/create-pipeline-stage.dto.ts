import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class CreatePipelineStageDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(1000)
  position!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  probability!: number;
}
