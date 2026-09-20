import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}
  create(data: CreateUserDto) {
    return this.repository.create(data);
  }
  find(id: string) {
    return this.repository.find(id);
  }
}
