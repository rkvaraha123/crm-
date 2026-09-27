import { Injectable } from '@nestjs/common';
import { ContactsRepository } from './contacts.repository';
import { ProductFeatureService } from '../common/product-feature.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    private readonly repository: ContactsRepository,
    private readonly features: ProductFeatureService,
  ) {}

  async list(query: ListContactsDto) {
    await this.features.require('contactsEnabled');
    return this.repository.list(query);
  }

  async find(id: string) {
    await this.features.require('contactsEnabled');
    return this.repository.find(id);
  }

  async create(data: CreateContactDto) {
    await this.features.require('contactsEnabled');
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateContactDto) {
    await this.features.require('contactsEnabled');
    return this.repository.update(id, data);
  }

  async archive(id: string) {
    await this.features.require('contactsEnabled');
    return this.repository.archive(id);
  }
}
