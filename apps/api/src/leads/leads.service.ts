import { Injectable } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly repository: LeadsRepository) {}

  list(query: ListLeadsDto) {
    return this.repository.list(query);
  }

  find(id: string) {
    return this.repository.find(id);
  }

  create(data: CreateLeadDto) {
    return this.repository.create(data);
  }

  update(id: string, data: UpdateLeadDto) {
    return this.repository.update(id, data);
  }

  assign(id: string, data: AssignLeadDto) {
    return this.repository.assign(id, data);
  }

  archive(id: string) {
    return this.repository.archive(id);
  }
}
