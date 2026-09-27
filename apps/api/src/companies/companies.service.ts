import { Injectable } from '@nestjs/common';
import { CompaniesRepository } from './companies.repository';
import { ProductFeatureService } from '../common/product-feature.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly repository: CompaniesRepository,
    private readonly features: ProductFeatureService,
  ) {}

  async list(query: ListCompaniesDto) {
    await this.features.require('companiesEnabled');
    return this.repository.list(query);
  }

  async find(id: string) {
    await this.features.require('companiesEnabled');
    return this.repository.find(id);
  }

  async create(data: CreateCompanyDto) {
    await this.features.require('companiesEnabled');
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateCompanyDto) {
    await this.features.require('companiesEnabled');
    return this.repository.update(id, data);
  }

  async archive(id: string) {
    await this.features.require('companiesEnabled');
    return this.repository.archive(id);
  }
}
