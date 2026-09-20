import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { OrganizationContextService } from './organization-context.service';
import { ContextRequest, VERIFIED_CONTEXT } from './tenant-access.guard';
@Injectable()
export class OrganizationContextInterceptor implements NestInterceptor {
  constructor(private readonly context: OrganizationContextService) {}
  intercept(
    execution: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const verified = execution.switchToHttp().getRequest<ContextRequest>()[
      VERIFIED_CONTEXT
    ];
    if (!verified) throw new UnauthorizedException('Verified context required');
    return new Observable((subscriber) =>
      this.context.run(verified, () => {
        const subscription = next.handle().subscribe(subscriber);
        return () => subscription.unsubscribe();
      }),
    );
  }
}
