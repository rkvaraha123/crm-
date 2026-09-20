import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest, CURRENT_USER } from './jwt-auth.guard';
export const CurrentUser = createParamDecorator(
  (_data: unknown, execution: ExecutionContext) =>
    execution.switchToHttp().getRequest<AuthenticatedRequest>()[CURRENT_USER],
);
