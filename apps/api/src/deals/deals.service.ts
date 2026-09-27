import { Injectable } from '@nestjs/common';
import { DealsRepository } from './deals.repository';
import { CreateDealDto } from './dto/create-deal.dto';
import { ListDealsDto } from './dto/list-deals.dto';
import { MoveDealStageDto } from './dto/move-deal-stage.dto';
import { UpdateDealDto } from './dto/update-deal.dto';

@Injectable()
export class DealsService {
  constructor(private readonly repository: DealsRepository) {}

  list(query: ListDealsDto) {
    return this.repository.list(query);
  }

  find(id: string) {
    return this.repository.find(id);
  }

  pipelines() {
    return this.repository.pipelines();
  }

  create(data: CreateDealDto) {
    return this.repository.create(data);
  }

  update(id: string, data: UpdateDealDto) {
    return this.repository.update(id, data);
  }

  moveStage(id: string, data: MoveDealStageDto) {
    return this.repository.moveStage(id, data);
  }

  archive(id: string) {
    return this.repository.archive(id);
  }
}
