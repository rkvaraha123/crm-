import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
if (existsSync('.env')) process.loadEnvFile('.env');
const source = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!source)
  throw new Error(
    'Set TEST_DATABASE_URL or DATABASE_URL for PostgreSQL integration tests',
  );
const url = new URL(source);
// Docker Compose supplies the internal hostname in .env. The harness itself
// runs on the host, where the published development database is localhost:5433.
if (url.hostname === 'postgres') {
  url.hostname = 'localhost';
  url.port = '5433';
}
const testDatabaseUrl = url.toString();
const schema = `rk_test_${randomUUID().replaceAll('-', '')}`;
if (!/^rk_test_[a-f0-9]{32}$/.test(schema))
  throw new Error('Invalid test schema');
const admin = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
let created = false;
try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  created = true;
  url.searchParams.set('schema', schema);
  const env = {
    ...process.env,
    DATABASE_URL: url.toString(),
    NODE_ENV: 'test',
    KEYCLOAK_PUBLIC_URL: 'http://identity.test',
    KEYCLOAK_INTERNAL_URL: 'http://identity.test',
    KEYCLOAK_ISSUER: 'http://identity.test/realms/test',
    KEYCLOAK_JWKS_URL: 'http://identity.test/realms/test/certs',
    KEYCLOAK_REALM: 'test',
    KEYCLOAK_API_AUDIENCE: 'api',
    KEYCLOAK_ADMIN_CLIENT_ID: 'admin',
    KEYCLOAK_ADMIN_CLIENT_SECRET: 'test-only-not-a-real-secret-00000000',
    CORS_ORIGINS: 'http://localhost:5173',
  };
  function run(args) {
    const result = spawnSync(process.execPath, args, {
      env,
      stdio: 'inherit',
      timeout: 180000,
      killSignal: 'SIGTERM',
    });
    if (result.error || result.status !== 0)
      throw new Error(
        `Integration command failed (${result.status ?? 'launch error'})`,
      );
  }
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  run([
    'node_modules/jest/bin/jest.js',
    '--config',
    'apps/api/jest.integration.config.cjs',
    '--runInBand',
  ]);
} catch (error) {
  // Avoid printing connection URLs/credentials from driver errors.
  console.error(
    error instanceof Error && error.message.startsWith('Integration command')
      ? error.message
      : 'PostgreSQL integration setup failed; check the database connection and schema privileges.',
  );
  process.exitCode = 1;
} finally {
  try {
    if (created)
      await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  } finally {
    await admin.$disconnect();
  }
}
