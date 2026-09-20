import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  exportJWK,
  importJWK,
  importSPKI,
  SignJWT,
  type JWTPayload,
  type JWK,
} from 'jose';
import { createPublicKey } from 'node:crypto';
const fixtures = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/test-only-signing-keys.json'), 'utf8'),
) as { keys: JWK[] };
export async function jwtFixture() {
  let current = 0;
  const publicKeys = await Promise.all(
    fixtures.keys.map(async (key) => {
      const publicKey = createPublicKey({
        key: key as never,
        format: 'jwk',
      }).export({ type: 'spki', format: 'pem' });
      return {
        ...(await exportJWK(await importSPKI(publicKey.toString(), 'RS256'))),
        kid: key.kid,
        alg: 'RS256',
        use: 'sig',
      };
    }),
  );
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ keys: [publicKeys[current]] }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  return {
    config: {
      KEYCLOAK_JWKS_URL: `http://127.0.0.1:${address.port}/certs`,
      KEYCLOAK_ISSUER: 'http://identity.test/realms/test',
      KEYCLOAK_API_AUDIENCE: 'api',
    },
    rotate: () => {
      current = 1;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    async token(
      overrides: JWTPayload = {},
      index = current,
      kid = fixtures.keys[index].kid,
    ) {
      const now = Math.floor(Date.now() / 1000);
      return new SignJWT({
        sub: 'fixture-subject',
        email: 'fixture@example.invalid',
        email_verified: true,
        typ: 'Bearer',
        iss: 'http://identity.test/realms/test',
        aud: 'api',
        iat: now,
        exp: now + 300,
        ...overrides,
      })
        .setProtectedHeader({ alg: 'RS256', kid })
        .sign(await importJWK(fixtures.keys[index], 'RS256'));
    },
  };
}
