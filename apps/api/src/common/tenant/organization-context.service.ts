import { ForbiddenException, Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
export interface OrganizationContext {
  readonly userId: string;
  readonly identityProviderId?: string;
  organizationId?: string;
  readonly systemAdmin: boolean;
}
@Injectable()
export class OrganizationContextService {
  private readonly storage = new AsyncLocalStorage<
    Readonly<OrganizationContext>
  >();
  // Internal entry point for the verified guard/interceptor, never a DTO setter.
  run<T>(context: OrganizationContext, callback: () => T): T {
    return this.storage.run(Object.freeze({ ...context }), callback);
  }
  current(): Readonly<OrganizationContext> {
    const context = this.storage.getStore();
    if (!context)
      throw new ForbiddenException('Verified request context required');
    return context;
  }
  requireOrganization(): string {
    const id = this.current().organizationId;
    if (!id)
      throw new ForbiddenException('Verified organization context required');
    return id;
  }
  requireSystemAdmin(): void {
    if (!this.current().systemAdmin)
      throw new ForbiddenException('System administrator required');
  }
}
