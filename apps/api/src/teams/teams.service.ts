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

  listMembers(teamId: string, page: PageDto) {
    return this.repository.listMembers(teamId, page);
  }

  addMember(teamId: string, userId: string) {
    return this.repository.addMember(teamId, userId);
  }

  removeMember(teamId: string, userId: string) {
    return this.repository.removeMember(teamId, userId);
  }
}
