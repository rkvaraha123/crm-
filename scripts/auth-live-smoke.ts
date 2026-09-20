import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { chromium, Browser, Page } from 'playwright';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { KeycloakAdminService } from '../apps/api/src/auth/keycloak-admin.service';
import { bootstrapAdmin } from '../apps/api/src/auth/bootstrap-admin';
import { createDefaultRoles } from '../apps/api/src/roles/default-roles';
import { validateEnvironment } from '../apps/api/src/common/environment';

// Local development integration test only. Temporary credentials never leave
// memory, and traces, screenshots, request bodies and tokens are never logged.
const publicUrl = process.env.KEYCLOAK_PUBLIC_URL!;
if (
  process.env.NODE_ENV === 'production' ||
  new URL(publicUrl).hostname !== 'localhost'
)
  throw new Error('Live smoke test is restricted to local development');
const databaseUrl = new URL(process.env.DATABASE_URL!);
if (databaseUrl.hostname === 'postgres') {
  databaseUrl.hostname = 'localhost';
  databaseUrl.port = '5433';
}
if (!['localhost', '127.0.0.1'].includes(databaseUrl.hostname))
  throw new Error('Local database required');
const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl.toString() } },
});
const config = new ConfigService(
  validateEnvironment({ ...process.env, KEYCLOAK_INTERNAL_URL: publicUrl }),
);
const admin = new KeycloakAdminService(config);
const realm = process.env.KEYCLOAK_REALM!;
const suffix = randomUUID();
const email = `smoke-${suffix}@example.invalid`;
const password = randomBytes(36).toString('base64url');
let keycloakId: string | undefined;
let crmId: string | undefined;
let browser: Browser | undefined;
let adminToken = '';
const orgIds: string[] = [];
let stage = 'setup';
const apiStatuses: number[] = [];
let tokenMetadata: Record<string, unknown> | undefined;
let inspectionPage: Page | undefined;
async function adminRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(
    `${publicUrl}/admin/realms/${encodeURIComponent(realm)}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) throw new Error('Local identity setup failed');
  return response;
}
async function main() {
  stage = 'service-account authentication';
  const response = await fetch(
    `${publicUrl}/realms/${realm}/protocol/openid-connect/token`,
    {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.KEYCLOAK_ADMIN_CLIENT_ID!,
        client_secret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET!,
      }),
    },
  );
  assert.equal(response.status, 200);
  adminToken = ((await response.json()) as { access_token: string })
    .access_token;
  stage = 'temporary identity provisioning';
  const created = await adminRequest('/users', {
    method: 'POST',
    body: JSON.stringify({
      username: email,
      email,
      enabled: true,
      emailVerified: true,
      firstName: 'Browser',
      lastName: 'Verification',
      requiredActions: [],
      credentials: [{ type: 'password', value: password, temporary: false }],
    }),
  });
  keycloakId = created.headers.get('location')?.split('/').pop();
  assert.ok(keycloakId);
  for (const name of ['Smoke A', 'Smoke B']) {
    const org = await prisma.$transaction(async (tx) => {
      const row = await tx.organization.create({
        data: {
          name,
          slug: `${name === 'Smoke A' ? 'smoke-a' : 'smoke-b'}-${suffix}`,
        },
      });
      await createDefaultRoles(tx, row.id);
      return row;
    });
    orgIds.push(org.id);
  }
  stage = 'explicit administrator bootstrap';
  const bootstrapEnv = {
    BOOTSTRAP_ADMIN_EMAIL: email,
    BOOTSTRAP_ADMIN_IDENTITY_ID: keycloakId,
    BOOTSTRAP_ORGANIZATION_SLUG: `smoke-a-${suffix}`,
  };
  crmId = await bootstrapAdmin(prisma, admin, bootstrapEnv);
  assert.equal(await bootstrapAdmin(prisma, admin, bootstrapEnv), crmId);
  stage = 'browser login';
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  inspectionPage = page;
  let authHeader: string | undefined;
  let pkceObserved = false;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.endsWith('/protocol/openid-connect/auth') &&
      url.searchParams.get('code_challenge_method') === 'S256' &&
      url.searchParams.get('response_type') === 'code'
    )
      pkceObserved = true;
    if (
      url.origin === 'http://localhost:3000' &&
      url.pathname === '/api/v1/me'
    ) {
      authHeader = request.headers().authorization;
      if (authHeader) {
        const claims = JSON.parse(
          Buffer.from(authHeader.split('.')[1], 'base64url').toString(),
        ) as Record<string, unknown>;
        tokenMetadata = {
          issuer: claims.iss,
          audience: claims.aud,
          type: claims.typ,
        };
      }
    }
  });
  page.on('response', (response) => {
    if (response.url().startsWith('http://localhost:3000/api/v1/me'))
      apiStatuses.push(response.status());
  });
  stage = 'frontend sign-in initialization';
  await page.goto('http://localhost:5173');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  stage = 'Keycloak login form';
  await page.locator('#username').fill(email);
  await page.locator('#password').fill(password);
  stage = 'Keycloak callback and authenticated workspace';
  await page.locator('#kc-login').click();
  await page
    .getByText('Connected to Smoke A', { exact: true })
    .waitFor({ timeout: 45000 });
  assert.ok(pkceObserved);
  assert.ok(authHeader);
  assert.equal(await page.getByRole('combobox').count(), 0);
  stage = 'authenticated API and tenant rejection';
  const me = await fetch('http://localhost:3000/api/v1/me', {
    headers: { Authorization: authHeader! },
  });
  assert.equal(me.status, 200);
  assert.equal(((await me.json()) as { id: string }).id, crmId);
  const denied = await fetch(
    `http://localhost:3000/api/v1/organizations/${orgIds[1]}/teams`,
    { headers: { Authorization: authHeader!, 'X-Organization-Id': orgIds[1] } },
  );
  assert.equal(denied.status, 403);
  const role = await prisma.role.findUniqueOrThrow({
    where: {
      organizationId_name: { organizationId: orgIds[1], name: 'ORG_ADMIN' },
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: orgIds[1],
      userId: crmId!,
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  });
  await prisma.userRole.create({
    data: { organizationId: orgIds[1], userId: crmId!, roleId: role.id },
  });
  stage = 'multiple-organization selection';
  await page.reload();
  const select = page.getByRole('combobox');
  await select.waitFor({ timeout: 30000 });
  await select.selectOption(orgIds[0]);
  await page.getByText('Connected to Smoke A', { exact: true }).waitFor();
  await select.selectOption(orgIds[1]);
  await page.getByText('Connected to Smoke B', { exact: true }).waitFor();
  const storageContainsToken = await page.evaluate(() =>
    [...Object.values(localStorage), ...Object.values(sessionStorage)].some(
      (value) => /eyJ[A-Za-z0-9_-]+\.eyJ/.test(value),
    ),
  );
  assert.equal(storageContainsToken, false);
  stage = 'logout';
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page
    .getByRole('button', { name: 'Sign in', exact: true })
    .waitFor({ timeout: 30000 });
  console.info(
    'PASS: real Keycloak PKCE login, authenticated /me, one-organization selection, foreign-tenant denial, multi-organization switching, in-memory tokens, logout, and idempotent bootstrap.',
  );
}
async function cleanup() {
  await browser?.close();
  if (crmId) {
    await prisma.userRole.deleteMany({ where: { userId: crmId } });
    await prisma.organizationMember.deleteMany({ where: { userId: crmId } });
    await prisma.user.delete({ where: { id: crmId } });
  }
  for (const id of orgIds) {
    await prisma.role.deleteMany({ where: { organizationId: id } });
    await prisma.organization.delete({ where: { id } });
  }
  if (keycloakId)
    await adminRequest(`/users/${encodeURIComponent(keycloakId)}`, {
      method: 'DELETE',
    });
  await prisma.$disconnect();
}
void main()
  .catch(async () => {
    console.info(
      'API response statuses:',
      apiStatuses,
      'Token routing metadata:',
      tokenMetadata,
    );
    if (inspectionPage) {
      console.info(
        'Browser location (no query or fragment):',
        new URL(inspectionPage.url()).pathname,
      );
      console.info(
        'Visible status:',
        (
          await inspectionPage
            .locator('body')
            .innerText()
            .catch(() => '')
        ).slice(0, 400),
      );
    }
    console.error(
      `Live authentication verification failed at: ${stage}. Sensitive details omitted.`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
      console.info(
        'Temporary verification identities and organizations cleaned up.',
      );
    } catch {
      console.error(
        'Temporary verification cleanup failed; review local smoke records.',
      );
      process.exitCode = 1;
      await prisma.$disconnect();
    }
  });
