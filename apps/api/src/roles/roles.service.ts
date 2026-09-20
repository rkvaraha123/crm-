import { Injectable } from '@nestjs/common';
import { RolesRepository } from './roles.repository';
import { PageDto } from '../common/dto/page.dto';
@Injectable()
export class RolesService {
  constructor(private readonly repository: RolesRepository) {}
  list(page: PageDto) {
    return this.repository.list(page);
  }
}
