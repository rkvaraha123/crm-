import { JwtVerifierService } from '../../auth/jwt-verifier.service';
import { IdentityLinkingService } from '../../auth/identity-linking.service';
import { OrganizationContextService } from './organization-context.service';
import { IdentityProvider } from '../../auth/identity.provider';
import type { Request } from 'express';
describe('verified organization context', () => {
  const context = new OrganizationContextService();
  it('fails closed outside a verified request', () => {
    expect(() => context.requireOrganization()).toThrow(
      'Verified request context required',
    );
  });
  it('requires an organization for tenant queries', () => {
    context.run({ userId: 'user', systemAdmin: true }, () =>
      expect(() => context.requireOrganization()).toThrow(
        'Verified organization context required',
      ),
    );
  });
  it('keeps concurrent asynchronous requests isolated', async () => {
    const values = await Promise.all(
      ['A', 'B'].map((organizationId) =>
        context.run(
          { userId: organizationId, organizationId, systemAdmin: false },
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return context.requireOrganization();
          },
        ),
      ),
    );
    expect(values).toEqual(['A', 'B']);
    expect(() => context.current()).toThrow();
  });
  it('rejects non-system administrators', () => {
    context.run({ userId: 'user', systemAdmin: false }, () =>
      expect(() => context.requireSystemAdmin()).toThrow(),
    );
  });
  it('does not authenticate client identity headers', async () => {
    const verifier = {
      verify: jest.fn().mockRejectedValue(new Error('Invalid authentication')),
    };
    const provider = new IdentityProvider(
      verifier as unknown as JwtVerifierService,
      {} as IdentityLinkingService,
    );
    await expect(
      provider.resolve({
        headers: { 'x-user-id': 'invented' },
      } as unknown as Request),
    ).rejects.toThrow('Invalid authentication');
    expect(verifier.verify).toHaveBeenCalledWith(undefined);
  });
});
