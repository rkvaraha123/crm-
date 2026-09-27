import { Injectable } from '@nestjs/common';
import { ContactsRepository } from './contacts.repository';
import { CreateContactDto } from './dto/create-contact.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly repository: ContactsRepository) {}

  list(query: ListContactsDto) {
    return this.repository.list(query);
  }

  find(id: string) {
    return this.repository.find(id);
  }

  create(data: CreateContactDto) {
    return this.repository.create(data);
  }

  update(id: string, data: UpdateContactDto) {
    return this.repository.update(id, data);
  }

  archive(id: string) {
    return this.repository.archive(id);
  }
}
