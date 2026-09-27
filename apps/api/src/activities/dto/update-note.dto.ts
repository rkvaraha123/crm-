import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class UpdateNoteDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 10000)
  body!: string;
}
