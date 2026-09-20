import { validateEnvironment } from './environment';
const valid = {
  KEYCLOAK_PUBLIC_URL: 'http://identity.test',
  KEYCLOAK_INTERNAL_URL: 'http://identity.test',
  KEYCLOAK_ISSUER: 'http://identity.test/realms/test',
  KEYCLOAK_JWKS_URL: 'http://identity.test/realms/test/certs',
  KEYCLOAK_REALM: 'test',
  KEYCLOAK_API_AUDIENCE: 'api',
  KEYCLOAK_ADMIN_CLIENT_ID: 'admin',
  KEYCLOAK_ADMIN_CLIENT_SECRET: 'test-only-not-a-real-secret-00000000',

  DATABASE_URL: 'postgresql://user:password@localhost:5432/test',
  CORS_ORIGINS: 'http://localhost:5173',
};
describe('environment validation', () => {
  it('parses ports and origin lists', () => {
    expect(validateEnvironment({ ...valid, API_PORT: '3001' })).toMatchObject({
      API_PORT: 3001,
      CORS_ORIGINS: ['http://localhost:5173'],
    });
  });
  it.each([
    { DATABASE_URL: 'https://example.com' },
    { API_PORT: '0' },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: 'https://example.com/path' },
  ])('rejects invalid configuration %j', (override) => {
    expect(() => validateEnvironment({ ...valid, ...override })).toThrow(
      'Invalid environment variables',
    );
  });
  it('does not leak secret values', () => {
    expect(() =>
      validateEnvironment({ ...valid, DATABASE_URL: 'secret-value' }),
    ).toThrow('Invalid environment variables: DATABASE_URL');
  });
});
