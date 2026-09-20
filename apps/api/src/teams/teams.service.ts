import { Injectable } from '@nestjs/common';
import { TeamsRepository } from './teams.repository';
import { PageDto } from '../common/dto/page.dto';
import { CreateTeamDto } from './dto/create-team.dto';
@Injectable()
export class TeamsService {
  constructor(private readonly repository: TeamsRepository) {}
  list(page: PageDto) {
    return this.repository.list(page);
  }
  create(data: CreateTeamDto) {
    return this.repository.create(data);
  }
}
