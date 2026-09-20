import { Injectable } from '@nestjs/common';
import { OrganizationsRepository } from './organizations.repository';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { PageDto } from '../common/dto/page.dto';
@Injectable()
export class OrganizationsService {
  constructor(private readonly repository: OrganizationsRepository) {}
  create(data: CreateOrganizationDto) {
    return this.repository.create(data);
  }
  findCurrent() {
    return this.repository.findCurrent();
  }
  createMember(data: CreateMemberDto) {
    return this.repository.createMember(data);
  }
  listMembers(page: PageDto) {
    return this.repository.listMembers(page);
  }
}
