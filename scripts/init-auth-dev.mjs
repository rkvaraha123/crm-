import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
if (process.env.NODE_ENV === 'production')
  throw new Error('Development initializer only');
let content = existsSync('.env')
  ? readFileSync('.env', 'utf8')
  : readFileSync('.env.example', 'utf8');
const defaults = {
  KEYCLOAK_PUBLIC_URL: 'http://localhost:8080',
  KEYCLOAK_INTERNAL_URL: 'http://localhost:8080',
  KEYCLOAK_REALM: 'rk-varaha-crm',
  KEYCLOAK_ISSUER: 'http://localhost:8080/realms/rk-varaha-crm',
  KEYCLOAK_JWKS_URL:
    'http://localhost:8080/realms/rk-varaha-crm/protocol/openid-connect/certs',
  KEYCLOAK_API_AUDIENCE: 'rk-varaha-api',
  KEYCLOAK_ADMIN_CLIENT_ID: 'rk-varaha-admin',
  KEYCLOAK_DB_USER: 'keycloak',
  KEYCLOAK_DB_NAME: 'keycloak',
  KC_BOOTSTRAP_ADMIN_USERNAME: 'local-admin',
  VITE_KEYCLOAK_URL: 'http://localhost:8080',
  VITE_KEYCLOAK_REALM: 'rk-varaha-crm',
  VITE_KEYCLOAK_CLIENT_ID: 'rk-varaha-web',
};
for (const key of [
  'KEYCLOAK_ADMIN_CLIENT_SECRET',
  'KEYCLOAK_DB_PASSWORD',
  'KC_BOOTSTRAP_ADMIN_PASSWORD',
])
  defaults[key] = randomBytes(32).toString('hex');
for (const [key, value] of Object.entries(defaults)) {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const existing = content.match(pattern)?.[0].slice(key.length + 1);
  if (existing && !existing.startsWith('replace-')) continue;
  content = pattern.test(content)
    ? content.replace(pattern, `${key}=${value}`)
    : `${content.trimEnd()}\n${key}=${value}\n`;
}
writeFileSync('.env', content, { mode: 0o600 });
console.info(
  'Local Keycloak settings initialized in ignored .env. Existing configured values preserved; secrets not printed.',
);
