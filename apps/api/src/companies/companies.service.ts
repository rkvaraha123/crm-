import { Injectable } from '@nestjs/common';
import { CompaniesRepository } from './companies.repository';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly repository: CompaniesRepository) {}

  list(query: ListCompaniesDto) {
    return this.repository.list(query);
  }

  find(id: string) {
    return this.repository.find(id);
  }

  create(data: CreateCompanyDto) {
    return this.repository.create(data);
  }

  update(id: string, data: UpdateCompanyDto) {
    return this.repository.update(id, data);
  }

  archive(id: string) {
    return this.repository.archive(id);
  }
}
