import { IsUUID } from 'class-validator';

export class MoveDealStageDto {
  @IsUUID()
  stageId!: string;
}
