import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { CreateUserDto } from './dto/create-user.dto';
const publicUser = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;
@Injectable()
export class UsersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
  ) {}
  create(data: CreateUserDto) {
    this.context.requireSystemAdmin();
    return this.prisma.user.create({ data, select: publicUser });
  }
  find(id: string) {
    const context = this.context.current();
    if (!context.systemAdmin && context.userId !== id)
      throw new ForbiddenException('User access denied');
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: publicUser,
    });
  }
}
