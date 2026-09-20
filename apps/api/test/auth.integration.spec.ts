import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { configureApp } from '../src/common/configure-app';
import { JwtVerifierService } from '../src/auth/jwt-verifier.service';
import { IdentityLinkingService } from '../src/auth/identity-linking.service';
import { createDefaultRoles } from '../src/roles/default-roles';
import { bootstrapAdmin } from '../src/auth/bootstrap-admin';
import { KeycloakAdminService } from '../src/auth/keycloak-admin.service';
import { jwtFixture } from './jwt-fixture';
describe('real JWT + PostgreSQL authentication integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixture: Awaited<ReturnType<typeof jwtFixture>>;
  let userId: string;
  let orgA: string;
  let orgB: string;
  const subject = 'auth-linked-subject';
  const bearer = async (claims = {}) => ({
    Authorization: `Bearer ${await fixture.token({ sub: subject, email: 'auth-user@example.invalid', ...claims })}`,
  });
  beforeAll(async () => {
    fixture = await jwtFixture();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JwtVerifierService)
      .useValue(new JwtVerifierService(new ConfigService(fixture.config)))
      .compile();
    app = module.createNestApplication();
    configureApp(app, ['http://localhost:5173']);
    await app.init();
    prisma = app.get(PrismaService);
    userId = (
      await prisma.user.create({
        data: {
          email: 'auth-user@example.invalid',
          firstName: 'Auth',
          lastName: 'Test',
          status: 'ACTIVE',
          identityProviderId: subject,
        },
      })
    ).id;
    for (const slug of ['auth-a', 'auth-b']) {
      const org = await prisma.$transaction(async (tx) => {
        const row = await tx.organization.create({
          data: { name: slug, slug },
        });
        await createDefaultRoles(tx, row.id);
        return row;
      });
      if (slug === 'auth-a') orgA = org.id;
      else orgB = org.id;
    }
    await prisma.organizationMember.create({
      data: {
        organizationId: orgA,
        userId,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
    const role = await prisma.role.findUniqueOrThrow({
      where: {
        organizationId_name: { organizationId: orgA, name: 'ORG_ADMIN' },
      },
    });
    await prisma.userRole.create({
      data: { organizationId: orgA, userId, roleId: role.id },
    });
  });
  afterAll(async () => {
    if (app) await app.close();
    if (fixture) await fixture.close();
  });
  it('keeps health public', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
  it('requires real bearer authentication', async () => {
    await request(app.getHttpServer()).get('/api/v1/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', 'Bearer fake')
      .expect(401);
  });
  it('maps an existing subject to the correct internal user', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set(await bearer())
      .expect(200);
    expect(response.body.id).toBe(userId);
    expect(
      response.body.organizations.map((o: { id: string }) => o.id),
    ).toEqual([orgA]);
    expect(response.body).not.toHaveProperty('identityProviderId');
  });
  it('links a verified invited user once and activates the account', async () => {
    const invited = await prisma.user.create({
      data: {
        email: 'invite-auth@example.invalid',
        firstName: 'Invite',
        lastName: 'Test',
      },
    });
    const headers = await bearer({
      sub: 'new-invited-sub',
      email: 'INVITE-AUTH@example.invalid',
    });
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set(headers)
      .expect(200);
    expect(
      await prisma.user.findUnique({ where: { id: invited.id } }),
    ).toMatchObject({
      identityProviderId: 'new-invited-sub',
      status: 'ACTIVE',
    });
    expect(
      await prisma.organizationMember.count({ where: { userId: invited.id } }),
    ).toBe(0);
  });
  it('rejects unverified first-login email', async () => {
    await prisma.user.create({
      data: {
        email: 'unverified-auth@example.invalid',
        firstName: 'Unverified',
        lastName: 'Test',
      },
    });
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set(
        await bearer({
          sub: 'unverified-sub',
          email: 'unverified-auth@example.invalid',
          email_verified: false,
        }),
      )
      .expect(403);
  });
  it('rejects unknown email without creating a user', async () => {
    const before = await prisma.user.count();
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set(
        await bearer({
          sub: 'unknown-sub',
          email: 'unknown-auth@example.invalid',
        }),
      )
      .expect(403);
    expect(await prisma.user.count()).toBe(before);
  });
  it('rejects a subject collision for an already-linked email', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set(await bearer({ sub: 'different-sub' }))
      .expect(403);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } }))
        .identityProviderId,
    ).toBe(subject);
  });
  it.each(['SUSPENDED', 'DISABLED'] as const)(
    'blocks %s users',
    async (status) => {
      const id = `blocked-${status}`;
      await prisma.user.create({
        data: {
          email: `${status.toLowerCase()}-auth@example.invalid`,
          firstName: 'Blocked',
          lastName: 'Test',
          status,
          identityProviderId: id,
        },
      });
      await request(app.getHttpServer())
        .get('/api/v1/me')
        .set(await bearer({ sub: id }))
        .expect(403);
    },
  );
  it('supports a verified selected organization', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams`)
      .set({ ...(await bearer()), 'X-Organization-Id': orgA })
      .expect(200);
  });
  it('requires the tenant header and rejects path/header disagreement', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams`)
      .set(await bearer())
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams`)
      .set({ ...(await bearer()), 'X-Organization-Id': orgB })
      .expect(403);
  });
  it('denies foreign organization membership despite a signed token', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgB}/teams`)
      .set({ ...(await bearer()), 'X-Organization-Id': orgB })
      .expect(403);
  });
  it('does not promote token roles to global CRM privileges', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set(
        await bearer({
          realm_access: { roles: ['SUPER_ADMIN'] },
          systemAdmin: true,
        }),
      )
      .send({ name: 'Denied', slug: 'auth-denied' })
      .expect(403);
  });
  it('filters inactive memberships from me and denies their tenant access', async () => {
    await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: orgA, userId } },
      data: { status: 'SUSPENDED' },
    });
    const response = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set(await bearer())
      .expect(200);
    expect(response.body.organizations).toEqual([]);
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams`)
      .set({ ...(await bearer()), 'X-Organization-Id': orgA })
      .expect(403);
    await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: orgA, userId } },
      data: { status: 'ACTIVE' },
    });
  });
  it('filters and denies inactive organizations', async () => {
    await prisma.organization.update({
      where: { id: orgA },
      data: { status: 'INACTIVE' },
    });
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/me')
          .set(await bearer())
          .expect(200)
      ).body.organizations,
    ).toEqual([]);
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams`)
      .set({ ...(await bearer()), 'X-Organization-Id': orgA })
      .expect(403);
    await prisma.organization.update({
      where: { id: orgA },
      data: { status: 'ACTIVE' },
    });
  });
  it('allows exactly one subject to win concurrent first-login linking', async () => {
    const email = 'race-auth@example.invalid';
    await prisma.user.create({
      data: { email, firstName: 'Race', lastName: 'Test' },
    });
    const linking = app.get(IdentityLinkingService);
    const outcomes = await Promise.allSettled(
      ['race-sub-a', 'race-sub-b'].map((subject) =>
        linking.resolve({ subject, email, emailVerified: true }),
      ),
    );
    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      outcomes.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
  });
  it('preserves identity links even through direct database changes', async () => {
    await expect(
      prisma.user.update({
        where: { id: userId },
        data: { identityProviderId: 'hijack' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.user.update({
        where: { id: userId },
        data: { identityProviderId: null },
      }),
    ).rejects.toThrow();
  });
  it('bootstraps an explicitly identified administrator idempotently', async () => {
    const id = randomUUID();
    const email = 'bootstrap-auth@example.invalid';
    const kcUser = {
      id,
      email,
      enabled: true,
      emailVerified: true,
      firstName: 'Bootstrap',
      lastName: 'Test',
    };
    const admin = {
      findUsers: async () => [kcUser],
      getUser: async () => kcUser,
    } as unknown as KeycloakAdminService;
    const env = {
      BOOTSTRAP_ADMIN_EMAIL: email,
      BOOTSTRAP_ADMIN_IDENTITY_ID: id,
      BOOTSTRAP_ORGANIZATION_SLUG: 'auth-a',
    };
    const first = await bootstrapAdmin(prisma, admin, env);
    expect(await bootstrapAdmin(prisma, admin, env)).toBe(first);
    expect(await prisma.userRole.count({ where: { userId: first } })).toBe(1);
    await expect(
      bootstrapAdmin(
        prisma,
        {
          findUsers: async () => [kcUser, kcUser],
        } as unknown as KeycloakAdminService,
        env,
      ),
    ).rejects.toThrow('Ambiguous');
  });
});
