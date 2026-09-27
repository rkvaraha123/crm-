import { Injectable } from '@nestjs/common';
import { TasksRepository } from './tasks.repository';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly repository: TasksRepository) {}

  list(query: ListTasksDto) {
    return this.repository.list(query);
  }

  find(id: string) {
    return this.repository.find(id);
  }

  create(data: CreateTaskDto) {
    return this.repository.create(data);
  }

  update(id: string, data: UpdateTaskDto) {
    return this.repository.update(id, data);
  }

  assign(id: string, data: AssignTaskDto) {
    return this.repository.assign(id, data);
  }

  archive(id: string) {
    return this.repository.archive(id);
  }
}
