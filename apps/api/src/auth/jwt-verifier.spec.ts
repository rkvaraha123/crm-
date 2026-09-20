import { ConfigService } from '@nestjs/config';
import { JwtVerifierService } from './jwt-verifier.service';
import { jwtFixture } from '../../test/jwt-fixture';
describe('cryptographic access-token verification', () => {
  let fixture: Awaited<ReturnType<typeof jwtFixture>>;
  let verifier: JwtVerifierService;
  beforeAll(async () => {
    fixture = await jwtFixture();
    verifier = new JwtVerifierService(new ConfigService(fixture.config));
  });
  afterAll(async () => fixture.close());
  it.each([undefined, '', 'Basic abc', 'Bearer invalid', 'Bearer a.b.c extra'])(
    'rejects missing or malformed authorization %s',
    async (header) => {
      await expect(verifier.verify(header)).rejects.toMatchObject({
        status: 401,
      });
    },
  );
  it('verifies the signature and returns only necessary verified claims', async () => {
    expect(
      await verifier.verify(
        `Bearer ${await fixture.token({ realm_access: { roles: ['SUPER_ADMIN'] } })}`,
      ),
    ).toEqual({
      subject: 'fixture-subject',
      email: 'fixture@example.invalid',
      emailVerified: true,
    });
  });
  it('rejects a forged signature', async () => {
    await expect(
      verifier.verify(`Bearer ${await fixture.token({}, 1, 'test-key-1')}`),
    ).rejects.toMatchObject({ status: 401 });
  });
  it.each([
    { exp: 1 },
    { iss: 'https://wrong.example' },
    { aud: 'unrelated' },
    { nbf: 9999999999 },
    { exp: undefined },
    { typ: 'ID' },
    { email: 'invalid' },
    { sub: '' },
  ])('rejects invalid claims %j', async (claims) => {
    await expect(
      verifier.verify(`Bearer ${await fixture.token(claims)}`),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('does not coerce an unverified email claim', async () => {
    expect(
      await verifier.verify(
        `Bearer ${await fixture.token({ email_verified: 'true' })}`,
      ),
    ).toMatchObject({ emailVerified: false });
  });
  it('refreshes JWKS when signing keys rotate', async () => {
    fixture.rotate();
    await new Promise((resolve) => setTimeout(resolve, 5100));
    await expect(
      verifier.verify(`Bearer ${await fixture.token()}`),
    ).resolves.toMatchObject({ subject: 'fixture-subject' });
  }, 15000);
});
